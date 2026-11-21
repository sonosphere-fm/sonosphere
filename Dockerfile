FROM oven/bun:1.4.5 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run typecheck && bun run build

FROM oven/bun:1.4.5 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.5-slim
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
COPY package.json ./
COPY --from=deps /app/node_modules node_modules
COPY server server
COPY shared shared
COPY --from=build /app/dist dist
USER bun
CMD ["bun", "server/index.ts"]
