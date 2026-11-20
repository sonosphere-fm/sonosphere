#!/bin/sh
# Takes a consistent copy of the live database while the site keeps running, compresses it, and prunes old copies.
# Runs hourly on the server (spin-backup.timer) and before every deploy. Usage: sh backup.sh [label]
# Kept: every copy from the last 48 hours, one a day for 14 days, one a week for 8 weeks, and the last 5 pre-deploy copies.
# Restore: stop the site, gunzip a copy over /opt/spin/data/needle.db (remove needle.db-wal and needle.db-shm), start it.
set -e
DB=${DB_PATH:-/opt/spin/data/needle.db}; OUT=${BACKUP_DIR:-/opt/spin-backup}; LABEL=${1:-hourly}
[ -f "$DB" ] || { echo "no database at $DB"; exit 0; }
mkdir -p "$OUT"
STAMP=$(date -u +%Y%m%d-%H%M%S); TMP="$OUT/.tmp-$STAMP.db"
sqlite3 "$DB" ".timeout 10000" ".backup '$TMP'"
[ "$(sqlite3 "$TMP" 'PRAGMA quick_check')" = ok ] || { rm -f "$TMP"; echo "backup failed its integrity check"; exit 1; }
gzip -6 "$TMP"; mv "$TMP.gz" "$OUT/spin-$STAMP-$LABEL.db.gz"
echo "backup: $OUT/spin-$STAMP-$LABEL.db.gz ($(du -h "$OUT/spin-$STAMP-$LABEL.db.gz" | cut -f1))"
cd "$OUT"
NOW=$(date -u +%s); SEEN_DAYS=""; SEEN_WEEKS=""
for f in $(ls -1 spin-*-hourly.db.gz 2>/dev/null | sort -r); do
  d=${f#spin-}; day=${d%%-*}; t=$(date -u -d "$(echo "$day" | sed 's/\(....\)\(..\)\(..\)/\1-\2-\3/')" +%s)
  age=$(( (NOW - t) / 86400 )); week=$(date -u -d "@$t" +%G%V)
  if [ $age -le 2 ]; then continue; fi
  if [ $age -le 14 ]; then case " $SEEN_DAYS " in *" $day "*) rm -f "$f";; *) SEEN_DAYS="$SEEN_DAYS $day";; esac; continue; fi
  if [ $age -le 56 ]; then case " $SEEN_WEEKS " in *" $week "*) rm -f "$f";; *) SEEN_WEEKS="$SEEN_WEEKS $week";; esac; continue; fi
  rm -f "$f"
done
ls -1 spin-*-deploy.db.gz 2>/dev/null | sort -r | tail -n +6 | xargs -r rm -f
find "$OUT" -name '.tmp-*' -mmin +60 -delete
