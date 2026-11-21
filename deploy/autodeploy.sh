#!/bin/sh
# Runs on the server every minute (spin-autodeploy.timer): when GitHub's main has a new commit, builds it here and
# ships it the same way deploy.sh does (deploy/remote.sh), so pushing is deploying. Needs a read-only GitHub token in
# /opt/spin/github.token (the repository is private); without one this does nothing.
# A commit that fails to build or start is not retried: the next push is. Output goes to `journalctl -u spin-autodeploy`,
# and, when /opt/spin/discord.webhook holds a Discord webhook link, each deploy is reported there with the log on failure.
set -e
A=/opt/spin; SRC=$A/src; REPO=github.com/bl791/sonosphere; BRANCH=main; LOG=$A/autodeploy.log
export PATH=/root/.bun/bin:$PATH
[ -s $A/github.token ] || exit 0
TOKEN=$(tr -d ' \n' < $A/github.token)
# the token is handed to git for each call, never written into the checkout's config
git_() { git -c credential.helper= -c "http.https://$REPO.extraHeader=Authorization: Basic $(printf 'x-access-token:%s' "$TOKEN" | base64 -w0)" "$@"; }

# notify COLOUR TITLE [log file]: a message on the Discord webhook, if one is set up; never stops a deploy
notify() {
  [ -s $A/discord.webhook ] || return 0
  COLOUR=$1 TITLE=$2 BODY_FILE=${3:-} HOOK=$(tr -d ' \n' < $A/discord.webhook) bun -e '
    const e = process.env, body = e.BODY_FILE ? (await Bun.file(e.BODY_FILE).text()).trim().split("\n").slice(-30).join("\n").slice(-1800) : "";
    const embed = { title: e.TITLE.slice(0, 250), color: Number(e.COLOUR), description: body ? "```\n" + body.replaceAll("```", "``​`") + "\n```" : undefined, timestamp: new Date().toISOString() };
    await fetch(e.HOOK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "Sonosphere deploys", embeds: [embed], allowed_mentions: { parse: [] } }), signal: AbortSignal.timeout(10_000) });
  ' 2>/dev/null || true
}

HEAD=$(git_ ls-remote "https://$REPO" "refs/heads/$BRANCH" | cut -f1)
[ -n "$HEAD" ] || { echo "GitHub did not answer (or the token was refused)"; exit 1; }
[ "$HEAD" = "$(cat $A/autodeploy.last 2>/dev/null)" ] && exit 0
# remembered before trying, so a commit that fails is not rebuilt every minute
echo "$HEAD" > $A/autodeploy.last

T0=$(date +%s)
[ -d $SRC/.git ] || git init -q $SRC
cd $SRC
if ! { git_ fetch -q --depth 50 "https://$REPO" "$BRANCH" && git checkout -q --force --detach "$HEAD"; } > $LOG 2>&1; then
  cat $LOG; notify 15548997 "Deploy failed: couldn't fetch ${HEAD%"${HEAD#???????}"}" $LOG; exit 1
fi
git clean -qfdx -e node_modules
WHAT=$(git log -1 --format='%h %an: %s')
echo "deploying $WHAT"
notify 16705372 "Deploying $WHAT"

ship() {
  set -e
  bun install --frozen-lockfile 2>&1 | tail -1
  bun run typecheck
  bun run build | tail -1
  ID=$(date -u +%Y%m%d-%H%M%S); R=$A/releases/$ID
  mkdir -p $R
  tar cf - server shared dist deploy package.json bun.lock | tar xf - -C $R
  echo "$HEAD" > $R/COMMIT
  flock $A/deploy.lock sh $R/deploy/remote.sh $R
}
if ! (ship) > $LOG 2>&1; then
  cat $LOG; notify 15548997 "Deploy failed: $WHAT (the live site was left as it was)" $LOG; exit 1
fi
cat $LOG

# fetch the new files once through Cloudflare so the first visitor doesn't wait on them (as deploy.sh does)
URL=$(sed -n 's/^SITE_URL=//p' $A/spin.env | tail -1)
if [ -n "$URL" ]; then
  STAFF=$(cat dist/staff.json)
  ls dist/assets | while read -r f; do case "$STAFF" in *"assets/$f"*) ;; *) echo "$URL/assets/$f" ;; esac; done |
    xargs -P 8 -n 1 curl -s -o /dev/null -H "Accept-Encoding: br, gzip" --max-time 30 || true
fi
echo "deployed $(git log -1 --format=%h)"
notify 5763719 "Deployed $WHAT in $(( $(date +%s) - T0 ))s" $LOG
