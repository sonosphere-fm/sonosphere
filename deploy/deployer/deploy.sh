#!/bin/sh
# Polls GitHub's main every minute and deploys new commits. Needs /opt/spin/github.token (read-only, the repo is
# private). Posts progress to the Discord webhook in /opt/spin/discord.webhook if there is one.
A=/opt/spin
SRC=$A/src
REPO=github.com/bl791/sonosphere
LOG=/tmp/deploy.log
COMPOSE="docker compose -f $SRC/compose.yaml"

git_() {
  auth=$(printf 'x-access-token:%s' "$(tr -d ' \n' < $A/github.token)" | base64 | tr -d '\n')
  git -c credential.helper= -c "http.https://$REPO.extraHeader=Authorization: Basic $auth" "$@"
}

notify() {
  [ -s $A/discord.webhook ] || return 0
  body=""
  [ -n "$3" ] && body=$(tail -n 30 "$3" | tail -c 1800)
  jq -n --arg title "$2" --argjson color "$1" --arg body "$body" '{
    username: "Sonosphere deploys",
    allowed_mentions: { parse: [] },
    embeds: [{ title: $title[:250], color: $color, description: (if $body == "" then null else "```\n\($body)\n```" end) }]
  }' | curl -s -o /dev/null --max-time 10 -H "content-type: application/json" -d @- "$(tr -d ' \n' < $A/discord.webhook)"
}

app_answers() {
  for _ in $(seq 60); do
    curl -sf -o /dev/null "http://127.0.0.1:$1/api/site" && return 0
    sleep 1
  done
  return 1
}

# Starts the new image next to the live one first, so a release that can't boot never replaces it.
preflight() {
  docker rm -f spin-preflight > /dev/null 2>&1
  docker run -d --name spin-preflight --network host --env-file $A/spin.env -e PORT=3100 \
    -v $A/data:/data "sonosphere:$1" > /dev/null || return 1
  app_answers 3100
  ok=$?
  [ $ok -eq 0 ] || docker logs --tail 30 spin-preflight
  docker rm -f spin-preflight > /dev/null
  return $ok
}

ship() {
  set -e
  docker build -q -t "sonosphere:$1" $SRC
  $COMPOSE exec -T backup sh /deploy/backup.sh deploy
  preflight "$1"
  docker tag "sonosphere:$1" sonosphere:live
  $COMPOSE up -d --wait postgres valkey app caddy backup
  $COMPOSE exec -T caddy caddy reload --config /etc/caddy/Caddyfile
  docker image ls sonosphere --format '{{.Tag}}' | grep -v live | tail -n +4 | sed 's/^/sonosphere:/' | xargs -r docker rmi -f
  docker image prune -f > /dev/null
}

deploy() {
  head=$1
  short=$(echo "$head" | cut -c1-7)
  if ! { git_ -C $SRC fetch -q --depth 50 "https://$REPO" main && git -C $SRC checkout -q --force --detach "$head"; } > $LOG 2>&1; then
    notify 15548997 "Deploy failed: couldn't fetch $short" $LOG
    return
  fi
  what=$(git -C $SRC log -1 --format='%h %an: %s')
  echo "deploying $what"
  notify 16705372 "Deploying $what"
  started=$(date +%s)
  if ! (ship "$head") > $LOG 2>&1; then
    cat $LOG
    notify 15548997 "Deploy failed: $what (the live site was left as it was)" $LOG
    return
  fi
  cat $LOG
  notify 5763719 "Deployed $what in $(( $(date +%s) - started ))s"
  # A container can't replace itself, so a throwaway one does it.
  $COMPOSE build -q deployer && docker run -d --rm -v /var/run/docker.sock:/var/run/docker.sock -v $A:$A \
    sonosphere-deployer $COMPOSE up -d deployer > /dev/null
}

while true; do
  head=$(git_ ls-remote "https://$REPO" refs/heads/main | cut -f1)
  if [ -n "$head" ] && [ "$head" != "$(cat $A/deployed 2>/dev/null)" ]; then
    echo "$head" > $A/deployed
    deploy "$head"
  fi
  sleep 60
done
