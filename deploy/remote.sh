#!/bin/sh
# Runs on the server, called by deploy.sh with the folder of the freshly unpacked release.
# Layout under /opt/spin: data/ (keys and caches, never touched here; the database is Postgres), releases/<id>/, slot/<port> -> a release,
# deps/<hash>/node_modules (shared between releases with the same lockfile).
# Each release runs as several processes (INSTANCES in spin.env, default half the cores) that share state through
# Valkey and Postgres. Two sets of ports take turns, even (3000, 3002, ...) and odd (3001, 3003, ...): the new release
# starts on the idle set, every process is health-checked, then nginx is pointed at them.
set -e
R=$1; A=/opt/spin; UP=/etc/nginx/spin-upstream.conf
same() { cmp -s "$1" "$2"; }
mkdir -p $A/releases $A/slot $A/deps $A/data

# which ports are live (a server that predates rolling deploys runs the old single service on 3000)
LIVE_PORTS=$(grep -o '127\.0\.0\.1:[0-9]*' $UP 2>/dev/null | cut -d: -f2 | tr '\n' ' '); LEGACY=""
[ -n "$LIVE_PORTS" ] || { LIVE_PORTS=3000; LEGACY=1; }
LIVE=${LIVE_PORTS%% *}
[ $((LIVE % 2)) = 0 ] && BASE=3001 || BASE=3000
N=$(sed -n 's/^INSTANCES=\([0-9]*\).*/\1/p' $A/spin.env 2>/dev/null | tail -1)
[ -n "$N" ] || N=$(($(nproc) / 2)); [ "$N" -ge 1 ] || N=1
NEXT_PORTS=""; i=0; while [ $i -lt $N ]; do NEXT_PORTS="$NEXT_PORTS $((BASE + 2 * i))"; i=$((i + 1)); done
OLD=$(readlink $A/slot/$LIVE 2>/dev/null || true)
stop_next() { for p in $(systemctl list-units --all --plain --no-legend 'spin@*' | awk '{print $1}' | sed 's/spin@\([0-9]*\).service/\1/'); do
  if [ $((p % 2)) = $((BASE % 2)) ]; then systemctl stop spin@$p 2>/dev/null || true; systemctl disable -q spin@$p 2>/dev/null || true; fi
done; }

# dependencies: installed once per lockfile, production packages only
H=$(cat $R/bun.lock $R/package.json | sha256sum | cut -c1-16)
if [ ! -d $A/deps/$H/node_modules ]; then
  mkdir -p $A/deps/$H.tmp; cp $R/bun.lock $R/package.json $A/deps/$H.tmp/
  (cd $A/deps/$H.tmp && bun install --production --frozen-lockfile 2>&1 | tail -1)
  rm -rf $A/deps/$H; mv $A/deps/$H.tmp $A/deps/$H
fi
ln -sfn $A/deps/$H/node_modules $R/node_modules
cp $R/deploy/backup.sh $A/backup.sh
cp $R/deploy/autodeploy.sh $A/autodeploy.sh

# a release that changes the database shape gets a backup taken first
if ! diff -rq $R/server/db/migrations "${OLD:-/nonexistent}/server/db/migrations" >/dev/null 2>&1; then sh $A/backup.sh deploy; fi

for u in spin@.service spin-backup.service spin-backup.timer spin-autodeploy.service spin-autodeploy.timer; do
  same $R/deploy/$u /etc/systemd/system/$u || { cp $R/deploy/$u /etc/systemd/system/$u; RELOAD=1; }
done
[ -z "$RELOAD" ] || { systemctl daemon-reload; systemctl enable -q --now spin-backup.timer; echo "units updated"; }
# deploying on push (deploy/autodeploy.sh) is on once there is a GitHub token to read the repository with
[ ! -s $A/github.token ] || systemctl is-enabled -q spin-autodeploy.timer || systemctl enable -q --now spin-autodeploy.timer

# start the new release on the idle ports and wait until every process answers
systemctl stop spin-drain.timer spin-drain.service 2>/dev/null || true
stop_next # anything left on the idle set, including processes beyond a lowered INSTANCES
for p in $NEXT_PORTS; do ln -sfn $R $A/slot/$p; systemctl start spin@$p; done
for p in $NEXT_PORTS; do
  i=0; until curl -sf -o /dev/null http://127.0.0.1:$p/api/site && curl -sf -o /dev/null http://127.0.0.1:$p/; do
    i=$((i+1)); [ $i -gt 150 ] && { echo "the new release did not come up on port $p; the live site is unchanged"; journalctl -u spin@$p -n 20 --no-pager; stop_next; exit 1; }
    sleep 0.1
  done
done

# Cloudflare connects over https; a self-signed certificate is enough for its "Full" mode (replace both files
# with a Cloudflare origin certificate for "Full (strict)")
[ -f /etc/nginx/spin-origin.crt ] || openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj /CN=spin-origin \
  -keyout /etc/nginx/spin-origin.key -out /etc/nginx/spin-origin.crt 2>/dev/null

# switch traffic: nginx finishes requests already in flight on the old copy
# least_conn: live-update sockets stay open for hours, so new visitors go to the process holding the fewest
{ echo "upstream spin { least_conn;"; for p in $NEXT_PORTS; do echo "  server 127.0.0.1:$p;"; done; echo "  keepalive 32; }"; } > $UP.new
same $R/deploy/spin.nginx /etc/nginx/sites-enabled/spin || { cp /etc/nginx/sites-enabled/spin /etc/nginx/spin.site.prev 2>/dev/null || true; cp $R/deploy/spin.nginx /etc/nginx/sites-enabled/spin; SITE=1; }
cp $UP $UP.prev 2>/dev/null || true; mv $UP.new $UP
if ! nginx -t 2>/dev/null; then
  nginx -t 2>&1 | tail -3
  if [ -f $UP.prev ]; then mv $UP.prev $UP; else rm -f $UP; fi
  [ -z "$SITE" ] || cp /etc/nginx/spin.site.prev /etc/nginx/sites-enabled/spin
  stop_next; echo "nginx rejected the new config; the live site is unchanged"; exit 1
fi
systemctl reload nginx
for p in $NEXT_PORTS; do systemctl enable -q spin@$p; done

# retire the old copy a few seconds later, once its open requests are done
if [ -n "$LEGACY" ]; then
  systemctl disable -q spin 2>/dev/null || true
  systemd-run -q --unit spin-drain --on-active=4s sh -c "systemctl stop spin; rm -f /etc/systemd/system/spin.service; systemctl daemon-reload; cd $A && rm -rf server src shared deploy node_modules package.json bun.lock tsconfig.json drizzle.config.ts"
else
  OLD_UNITS=""; for p in $LIVE_PORTS; do systemctl disable -q spin@$p 2>/dev/null || true; OLD_UNITS="$OLD_UNITS spin@$p"; done
  systemd-run -q --unit spin-drain --on-active=4s systemctl stop $OLD_UNITS
fi

# keep the three newest releases, and only the dependency sets they use
cd $A/releases; ls -1 | sort -r | tail -n +4 | while read old; do [ "$A/releases/$old" = "$OLD" ] || rm -rf "$old"; done
for d in $A/deps/*; do ls -l $A/releases/*/node_modules 2>/dev/null | grep -q "$d/" || rm -rf "$d"; done
echo "live on ports$NEXT_PORTS: $(basename $R)"
