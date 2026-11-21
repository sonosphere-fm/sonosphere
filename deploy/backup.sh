#!/bin/sh
# Usage: sh backup.sh [label]. Keeps 48h of hourly dumps, then one a day for 14 days, one a week for 8 weeks,
# and the last 5 pre-deploy dumps. With BACKUP_S3_* set, one dump a day and every pre-deploy dump are also copied
# to that S3-compatible bucket, which keeps one a day for 14 days, one a week for 8 weeks and the last 3 pre-deploy dumps.
# Restore: docker compose stop app, then
#   docker compose exec -T postgres pg_restore --clean --if-exists --no-owner -U spin -d sonosphere < /opt/spin-backup/FILE
set -e
export PGUSER=$POSTGRES_USER PGPASSWORD=$POSTGRES_PASSWORD PGDATABASE=$POSTGRES_DB
OUT=/backups
LABEL=${1:-hourly}
STAMP=$(date -u +%Y%m%d-%H%M%S)
TMP="$OUT/.tmp-$STAMP.dump"
NAME="spin-$STAMP-$LABEL.dump"
MAX_MB=${BACKUP_S3_MAX_MB:-5000}

pg_dump --format=custom --compress=6 --no-owner --exclude-table-data=spotify_artist_pics --file="$TMP"
if ! pg_restore --list "$TMP" > /dev/null; then
  rm -f "$TMP"
  echo "the dump could not be read back"
  exit 1
fi
mv "$TMP" "$OUT/$NAME"
echo "backup: $NAME ($(du -h "$OUT/$NAME" | cut -f1))"

# Reads dump names on stdin and prints the ones past retention: everything from the last
# $1 days, then one a day until day 14, one a week until week 8, and the newest $2 deploy dumps.
expired() {
  keep_all_days=$1
  keep_deploys=$2
  names=$(sort -r)
  now=$(date -u +%s)
  seen_days=""
  seen_weeks=""
  for f in $(echo "$names" | grep -- '-hourly\.dump$'); do
    day=$(echo "$f" | cut -d- -f2)
    t=$(date -u -d "$(echo "$day" | sed 's/\(....\)\(..\)\(..\)/\1-\2-\3/')" +%s)
    age=$(( (now - t) / 86400 ))
    week=$(date -u -d "@$t" +%G%V)
    if [ $age -le "$keep_all_days" ]; then
      continue
    elif [ $age -le 14 ]; then
      case " $seen_days " in *" $day "*) echo "$f" ;; *) seen_days="$seen_days $day" ;; esac
    elif [ $age -le 56 ]; then
      case " $seen_weeks " in *" $week "*) echo "$f" ;; *) seen_weeks="$seen_weeks $week" ;; esac
    else
      echo "$f"
    fi
  done
  echo "$names" | grep -- '-deploy\.dump$' | tail -n +$((keep_deploys + 1))
}

cd "$OUT"
ls -1 spin-*-hourly.dump spin-*-deploy.dump 2>/dev/null | expired 2 5 | xargs -r rm -f
find "$OUT" -name '.tmp-*' -mmin +60 -delete

[ -n "$BACKUP_S3_BUCKET" ] || exit 0

s3() {
  method=$1
  key=$2
  shift 2
  curl -sf --aws-sigv4 "aws:amz:${BACKUP_S3_REGION:-auto}:s3" --user "$BACKUP_S3_ACCESS_KEY_ID:$BACKUP_S3_SECRET_ACCESS_KEY" \
    -X "$method" "$BACKUP_S3_ENDPOINT/$BACKUP_S3_BUCKET/$key" "$@"
}

# The bucket holds a few dozen objects, well under one 1000-key page.
listing=$(s3 GET "?list-type=2") || { echo "offsite: listing failed"; exit 0; }
remote=$(echo "$listing" | grep -o '<Key>[^<]*</Key>' | sed 's/<[^>]*>//g')
remote_mb=$(echo "$listing" | grep -o '<Size>[0-9]*</Size>' | sed 's/<[^>]*>//g' | awk '{ s += $1 } END { print int(s / 1048576) }')

today=$(echo "$NAME" | cut -d- -f2)
if [ "$LABEL" = hourly ] && echo "$remote" | grep -q -- "^spin-$today-.*-hourly\.dump$"; then
  :
elif [ "$remote_mb" -ge "$MAX_MB" ]; then
  echo "offsite: bucket is at ${remote_mb}MB (cap ${MAX_MB}MB), not uploading"
elif s3 PUT "$NAME" -T "$OUT/$NAME" -o /dev/null; then
  echo "offsite: uploaded $NAME"
  remote=$(printf '%s\n%s' "$remote" "$NAME")
else
  echo "offsite: upload failed"
fi

for f in $(echo "$remote" | grep -E '^spin-.*-(hourly|deploy)\.dump$' | expired 0 3); do
  s3 DELETE "$f" -o /dev/null && echo "offsite: removed $f"
done
exit 0
