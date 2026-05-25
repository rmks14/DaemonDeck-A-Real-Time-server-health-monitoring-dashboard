FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=5000
ENV DATABASE_PATH=/app/data/daemondeck.sqlite

WORKDIR /app

RUN groupadd --system daemondeck \
  && useradd --system --gid daemondeck --home-dir /app daemondeck \
  && mkdir -p /app/data \
  && chown -R daemondeck:daemondeck /app

COPY --from=build --chown=daemondeck:daemondeck /app/package*.json ./
COPY --from=build --chown=daemondeck:daemondeck /app/node_modules ./node_modules
COPY --from=build --chown=daemondeck:daemondeck /app/dist ./dist

USER daemondeck

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
