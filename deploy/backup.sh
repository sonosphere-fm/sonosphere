#!/bin/sh
# Usage: sh backup.sh [label]. Keeps 48h of hourly dumps, then one a day for 14 days, one a week for 8 weeks,
# and the last 5 pre-deploy dumps.
# Restore: docker compose stop app, then
#   docker compose exec -T postgres pg_restore --clean --if-exists --no-owner -U spin -d sonosphere < /opt/spin-backup/FILE
set -e
export PGUSER=$POSTGRES_USER PGPASSWORD=$POSTGRES_PASSWORD PGDATABASE=$POSTGRES_DB
OUT=/backups
LABEL=${1:-hourly}
STAMP=$(date -u +%Y%m%d-%H%M%S)
TMP="$OUT/.tmp-$STAMP.dump"
FILE="$OUT/spin-$STAMP-$LABEL.dump"

pg_dump --format=custom --compress=6 --no-owner --file="$TMP"
if ! pg_restore --list "$TMP" > /dev/null; then
  rm -f "$TMP"
  echo "the dump could not be read back"
  exit 1
fi
mv "$TMP" "$FILE"
echo "backup: $FILE ($(du -h "$FILE" | cut -f1))"

cd "$OUT"
NOW=$(date -u +%s)
SEEN_DAYS=""
SEEN_WEEKS=""
for f in $(ls -1 spin-*-hourly.dump 2>/dev/null | sort -r); do
  day=$(echo "$f" | cut -d- -f2)
  t=$(date -u -d "$(echo "$day" | sed 's/\(....\)\(..\)\(..\)/\1-\2-\3/')" +%s)
  age=$(( (NOW - t) / 86400 ))
  week=$(date -u -d "@$t" +%G%V)
  if [ $age -le 2 ]; then
    continue
  elif [ $age -le 14 ]; then
    case " $SEEN_DAYS " in *" $day "*) rm -f "$f" ;; *) SEEN_DAYS="$SEEN_DAYS $day" ;; esac
  elif [ $age -le 56 ]; then
    case " $SEEN_WEEKS " in *" $week "*) rm -f "$f" ;; *) SEEN_WEEKS="$SEEN_WEEKS $week" ;; esac
  else
    rm -f "$f"
  fi
done
ls -1 spin-*-deploy.dump 2>/dev/null | sort -r | tail -n +6 | xargs -r rm -f
find "$OUT" -name '.tmp-*' -mmin +60 -delete
