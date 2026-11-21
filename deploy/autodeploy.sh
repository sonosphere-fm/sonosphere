#!/bin/sh
# Runs on the server every minute (spin-autodeploy.timer): when GitHub's main has a new commit, builds it here and
# ships it the same way deploy.sh does (deploy/remote.sh), so pushing is deploying. Needs a read-only GitHub token in
# /opt/spin/github.token (the repository is private); without one this does nothing.
# A commit that fails to build or start is not retried: the next push is. Output goes to `journalctl -u spin-autodeploy`.
set -e
A=/opt/spin; SRC=$A/src; REPO=github.com/bl791/sonosphere; BRANCH=main
export PATH=/root/.bun/bin:$PATH
[ -s $A/github.token ] || exit 0
TOKEN=$(tr -d ' \n' < $A/github.token)
# the token is handed to git for each call, never written into the checkout's config
git_() { git -c credential.helper= -c "http.https://$REPO.extraHeader=Authorization: Basic $(printf 'x-access-token:%s' "$TOKEN" | base64 -w0)" "$@"; }

HEAD=$(git_ ls-remote "https://$REPO" "refs/heads/$BRANCH" | cut -f1)
[ -n "$HEAD" ] || { echo "GitHub did not answer (or the token was refused)"; exit 1; }
[ "$HEAD" = "$(cat $A/autodeploy.last 2>/dev/null)" ] && exit 0

[ -d $SRC/.git ] || git init -q $SRC
cd $SRC
git_ fetch -q --depth 50 "https://$REPO" "$BRANCH"
git checkout -q --force --detach "$HEAD"
git clean -qfdx -e node_modules
echo "deploying $(git log -1 --format='%h %an: %s')"
# remembered before trying, so a commit that fails is not rebuilt every minute
echo "$HEAD" > $A/autodeploy.last

bun install --frozen-lockfile 2>&1 | tail -1
bun run typecheck
bun run build | tail -1
ID=$(date -u +%Y%m%d-%H%M%S); R=$A/releases/$ID
mkdir -p $R
tar cf - server shared dist deploy package.json bun.lock | tar xf - -C $R
echo "$HEAD" > $R/COMMIT
flock $A/deploy.lock sh $R/deploy/remote.sh $R

# fetch the new files once through Cloudflare so the first visitor doesn't wait on them (as deploy.sh does)
URL=$(sed -n 's/^SITE_URL=//p' $A/spin.env | tail -1)
if [ -n "$URL" ]; then
  STAFF=$(cat dist/staff.json)
  ls dist/assets | while read -r f; do case "$STAFF" in *"assets/$f"*) ;; *) echo "$URL/assets/$f" ;; esac; done |
    xargs -P 8 -n 1 curl -s -o /dev/null -H "Accept-Encoding: br, gzip" --max-time 30 || true
fi
echo "deployed $(git log -1 --format=%h)"
