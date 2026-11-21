#!/bin/sh
# Takes a consistent dump of the live database while the site keeps running and prunes old dumps.
# Runs hourly on the server (spin-backup.timer) and before every deploy that changes the schema. Usage: sh backup.sh [label]
# Kept: every dump from the last 48 hours, one a day for 14 days, one a week for 8 weeks, and the last 5 pre-deploy dumps.
# Restore: stop both spin@ services, then
#   pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" /opt/spin-backup/spin-<stamp>-<label>.dump
# and start them again. Dumps from before Postgres are SQLite files (*.db.gz); scripts/sqlite-to-pg.ts loads those.
set -e
[ -n "$DATABASE_URL" ] || DATABASE_URL=$(sed -n 's/^DATABASE_URL=//p' /opt/spin/spin.env 2>/dev/null)
[ -n "$DATABASE_URL" ] || { echo "no DATABASE_URL"; exit 0; }
OUT=${BACKUP_DIR:-/opt/spin-backup}; LABEL=${1:-hourly}
mkdir -p "$OUT"; chmod 700 "$OUT"
STAMP=$(date -u +%Y%m%d-%H%M%S); TMP="$OUT/.tmp-$STAMP.dump"
pg_dump --format=custom --compress=6 --no-owner --dbname="$DATABASE_URL" --file="$TMP"
pg_restore --list "$TMP" >/dev/null || { rm -f "$TMP"; echo "the dump could not be read back"; exit 1; }
mv "$TMP" "$OUT/spin-$STAMP-$LABEL.dump"
echo "backup: $OUT/spin-$STAMP-$LABEL.dump ($(du -h "$OUT/spin-$STAMP-$LABEL.dump" | cut -f1))"
cd "$OUT"
NOW=$(date -u +%s); SEEN_DAYS=""; SEEN_WEEKS=""
for f in $(ls -1 spin-*-hourly.dump 2>/dev/null | sort -r); do
  d=${f#spin-}; day=${d%%-*}; t=$(date -u -d "$(echo "$day" | sed 's/\(....\)\(..\)\(..\)/\1-\2-\3/')" +%s)
  age=$(( (NOW - t) / 86400 )); week=$(date -u -d "@$t" +%G%V)
  if [ $age -le 2 ]; then continue; fi
  if [ $age -le 14 ]; then case " $SEEN_DAYS " in *" $day "*) rm -f "$f";; *) SEEN_DAYS="$SEEN_DAYS $day";; esac; continue; fi
  if [ $age -le 56 ]; then case " $SEEN_WEEKS " in *" $week "*) rm -f "$f";; *) SEEN_WEEKS="$SEEN_WEEKS $week";; esac; continue; fi
  rm -f "$f"
done
ls -1 spin-*-deploy.dump 2>/dev/null | sort -r | tail -n +6 | xargs -r rm -f
find "$OUT" -name '.tmp-*' -mmin +60 -delete
