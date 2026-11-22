FROM oven/bun:1.4.5 AS build
WORKDIR /app
# Keep system packages cached across source and release changes.
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG GIT_SHA
ENV SENTRY_RELEASE=$GIT_SHA
RUN bun run typecheck && bun run build

FROM oven/bun:1.4.5 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.5-slim
ARG GIT_SHA
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data PORT=3000 SENTRY_RELEASE=$GIT_SHA
COPY package.json ./
COPY --from=deps /app/node_modules node_modules
COPY server server
COPY --from=build /app/server/changelog/history.json server/changelog/history.json
COPY shared shared
COPY --from=build /app/dist dist
USER bun
CMD ["bun", "server/index.ts"]
