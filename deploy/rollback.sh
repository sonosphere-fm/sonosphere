#!/bin/sh
# Puts the previous release back in service, the same way a deploy does. Usage: sh deploy/rollback.sh
# It does not undo database changes; restore a backup for that (see deploy/backup.sh).
set -e
D=$(cd "$(dirname "$0")" && pwd)
ssh -o BatchMode=yes -o IdentitiesOnly=yes -i "${SPIN_KEY:-$HOME/.ssh/id_ed25519}" -o ConnectTimeout=15 -o UserKnownHostsFile="$D/known_hosts" "${SPIN_HOST:-root@OLD_VPS_IP}" 'TERM=dumb sh -c '"'"'
set -e
LIVE=$(sed -n "s/.*127\.0\.0\.1:\([0-9]*\).*/\1/p" /etc/nginx/spin-upstream.conf | head -1)
NOW=$(basename $(readlink /opt/spin/slot/$LIVE))
PREV=$(ls -1 /opt/spin/releases | sort -r | grep -v "^$NOW$" | head -1)
[ -n "$PREV" ] || { echo "no earlier release to go back to"; exit 1; }
echo "going back from $NOW to $PREV"
sh /opt/spin/releases/$PREV/deploy/remote.sh /opt/spin/releases/$PREV
'"'"'' 2>&1 | grep -v "bashrc\|tput"
