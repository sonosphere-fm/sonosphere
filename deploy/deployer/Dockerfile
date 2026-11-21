FROM docker:26-cli
RUN apk add --no-cache git curl jq
COPY deploy.sh /deploy.sh
CMD ["sh", "/deploy.sh"]
