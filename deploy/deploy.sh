#!/bin/sh
# Ships the site to the server with no downtime. Usage: sh deploy/deploy.sh
# The browser app is built here, so the server only unpacks files. The new copy starts next to the live one,
# must answer a health check, and only then does nginx switch to it (deploy/remote.sh). A failed deploy leaves
# the live site untouched. The connection is kept open for ten minutes so repeat deploys skip the SSH handshake.
set -e
D=$(cd "$(dirname "$0")" && pwd); cd "$D/.."
HOST=${SPIN_HOST:-root@OLD_VPS_IP}
T0=$(date +%s)
bun run typecheck
bun run build | tail -1
ID=$(date -u +%Y%m%d-%H%M%S)
SSH="ssh -o BatchMode=yes -o IdentitiesOnly=yes -i ${SPIN_KEY:-$HOME/.ssh/id_ed25519} -o ConnectTimeout=15 -o UserKnownHostsFile=$D/known_hosts -o ControlMaster=auto -o ControlPath=$HOME/.ssh/spin-%C -o ControlPersist=600"
OUT=$(COPYFILE_DISABLE=1 tar czf - --exclude .DS_Store server shared dist deploy package.json bun.lock |
  $SSH "$HOST" "TERM=dumb sh -c 'set -e; R=/opt/spin/releases/$ID; mkdir -p \$R; tar xzf - -C \$R 2>/dev/null; sh \$R/deploy/remote.sh \$R'" 2>&1) ||
  { echo "$OUT" | grep -v 'bashrc\|tput'; echo "DEPLOY FAILED (the live site was left as it was)"; exit 1; }
echo "$OUT" | grep -v 'bashrc\|tput' || true
echo "deployed in $(( $(date +%s) - T0 ))s"
