#!/bin/sh
# Runs on the server, called by deploy.sh with the folder of the freshly unpacked release.
# Layout under /opt/spin: data/ (database, never touched here), releases/<id>/, slot/<port> -> a release,
# deps/<hash>/node_modules (shared between releases with the same lockfile).
# Two ports take turns: the new release starts on the idle one, is health-checked, then nginx is pointed at it.
set -e
R=$1; A=/opt/spin; UP=/etc/nginx/spin-upstream.conf
same() { cmp -s "$1" "$2"; }
mkdir -p $A/releases $A/slot $A/deps $A/data

# which port is live (a server that predates rolling deploys runs the old single service on 3000)
LIVE=$(sed -n 's/.*127\.0\.0\.1:\([0-9]*\).*/\1/p' $UP 2>/dev/null | head -1); LEGACY=""
[ -n "$LIVE" ] || { LIVE=3000; LEGACY=1; }
[ "$LIVE" = 3000 ] && NEXT=3001 || NEXT=3000
OLD=$(readlink $A/slot/$LIVE 2>/dev/null || true)

# dependencies: installed once per lockfile, production packages only
H=$(cat $R/bun.lock $R/package.json | sha256sum | cut -c1-16)
if [ ! -d $A/deps/$H/node_modules ]; then
  mkdir -p $A/deps/$H.tmp; cp $R/bun.lock $R/package.json $A/deps/$H.tmp/
  (cd $A/deps/$H.tmp && bun install --production --frozen-lockfile 2>&1 | tail -1)
  rm -rf $A/deps/$H; mv $A/deps/$H.tmp $A/deps/$H
fi
ln -sfn $A/deps/$H/node_modules $R/node_modules
cp $R/deploy/backup.sh $A/backup.sh

# a release that changes the database shape gets a backup taken first
if [ -f $A/data/needle.db ] && ! diff -rq $R/server/db/migrations "${OLD:-/nonexistent}/server/db/migrations" >/dev/null 2>&1; then sh $A/backup.sh deploy; fi

for u in spin@.service spin-backup.service spin-backup.timer; do
  same $R/deploy/$u /etc/systemd/system/$u || { cp $R/deploy/$u /etc/systemd/system/$u; RELOAD=1; }
done
[ -z "$RELOAD" ] || { systemctl daemon-reload; systemctl enable -q --now spin-backup.timer; echo "units updated"; }

# start the new release on the idle port and wait until it answers
systemctl stop spin-drain.timer spin-drain.service 2>/dev/null || true
systemctl stop spin@$NEXT 2>/dev/null || true
ln -sfn $R $A/slot/$NEXT
systemctl start spin@$NEXT
i=0; until curl -sf -o /dev/null http://127.0.0.1:$NEXT/api/site && curl -sf -o /dev/null http://127.0.0.1:$NEXT/; do
  i=$((i+1)); [ $i -gt 150 ] && { echo "the new release did not come up; the live site is unchanged"; journalctl -u spin@$NEXT -n 20 --no-pager; systemctl stop spin@$NEXT; exit 1; }
  sleep 0.1
done

# Cloudflare connects over https; a self-signed certificate is enough for its "Full" mode (replace both files
# with a Cloudflare origin certificate for "Full (strict)")
[ -f /etc/nginx/spin-origin.crt ] || openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj /CN=spin-origin \
  -keyout /etc/nginx/spin-origin.key -out /etc/nginx/spin-origin.crt 2>/dev/null

# switch traffic: nginx finishes requests already in flight on the old copy
echo "upstream spin { server 127.0.0.1:$NEXT; keepalive 16; }" > $UP.new
same $R/deploy/spin.nginx /etc/nginx/sites-enabled/spin || { cp /etc/nginx/sites-enabled/spin /etc/nginx/spin.site.prev 2>/dev/null || true; cp $R/deploy/spin.nginx /etc/nginx/sites-enabled/spin; SITE=1; }
cp $UP $UP.prev 2>/dev/null || true; mv $UP.new $UP
if ! nginx -t 2>/dev/null; then
  nginx -t 2>&1 | tail -3
  if [ -f $UP.prev ]; then mv $UP.prev $UP; else rm -f $UP; fi
  [ -z "$SITE" ] || cp /etc/nginx/spin.site.prev /etc/nginx/sites-enabled/spin
  systemctl stop spin@$NEXT; echo "nginx rejected the new config; the live site is unchanged"; exit 1
fi
systemctl reload nginx
systemctl enable -q spin@$NEXT

# retire the old copy a few seconds later, once its open requests are done
if [ -n "$LEGACY" ]; then
  systemctl disable -q spin 2>/dev/null || true
  systemd-run -q --unit spin-drain --on-active=4s sh -c "systemctl stop spin; rm -f /etc/systemd/system/spin.service; systemctl daemon-reload; cd $A && rm -rf server src shared deploy node_modules package.json bun.lock tsconfig.json drizzle.config.ts"
else
  systemctl disable -q spin@$LIVE 2>/dev/null || true
  systemd-run -q --unit spin-drain --on-active=4s systemctl stop spin@$LIVE
fi

# keep the three newest releases, and only the dependency sets they use
cd $A/releases; ls -1 | sort -r | tail -n +4 | while read old; do [ "$A/releases/$old" = "$OLD" ] || rm -rf "$old"; done
for d in $A/deps/*; do ls -l $A/releases/*/node_modules 2>/dev/null | grep -q "$d/" || rm -rf "$d"; done
echo "live on port $NEXT: $(basename $R)"
