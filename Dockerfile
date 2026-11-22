FROM oven/bun:1.4.5 AS build
# deploy.sh generates server/changelog/history.gitlog before invoking Docker.
# For a manual build, generate it with the same git log command first.
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG GIT_SHA
ENV SENTRY_RELEASE=$GIT_SHA
RUN bun run typecheck && CHANGELOG_GIT_LOG=server/changelog/history.gitlog bun run build

FROM oven/bun:1.4.5 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.5-slim
ARG GIT_SHA
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data PORT=3000 SENTRY_RELEASE=$GIT_SHA
COPY package.json LICENSE NOTICE ./
COPY --from=deps /app/node_modules node_modules
COPY server server
COPY --from=build /app/server/changelog/history.json server/changelog/history.json
COPY shared shared
COPY --from=build /app/dist dist
USER bun
CMD ["bun", "server/index.ts"]
