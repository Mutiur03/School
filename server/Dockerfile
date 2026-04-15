# syntax=docker/dockerfile:1

# Pin via build-arg in CI for stable cache, e.g. NODE_IMAGE=node:22-bookworm-slim@sha256:...
ARG NODE_IMAGE=node:22-bookworm-slim

# ---------------- RUNTIME OS DEPS (cache-friendly) ----------------
# Own stage: rebuilds only when this RUN / NODE_IMAGE changes — not when app code changes.
FROM ${NODE_IMAGE} AS runtime-base

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    curl \
    netcat-traditional \
    postgresql-client \
    && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# ---------------- BUILD STAGE ----------------
FROM ${NODE_IMAGE} AS builder

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app/packages/shared-schemas
COPY packages/shared-schemas/package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --ignore-scripts

WORKDIR /app/server
COPY server/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --ignore-scripts

COPY packages/shared-schemas /app/packages/shared-schemas
COPY server /app/server

WORKDIR /app/packages/shared-schemas
RUN npm run build && npm prune --omit=dev

WORKDIR /app/server
RUN npx prisma generate && npm run build

# ---------------- RUNTIME STAGE ----------------
FROM runtime-base AS runtime

ENV NODE_ENV=production

WORKDIR /app/server

COPY --from=builder /app/server/package*.json ./
COPY --from=builder /app/packages/shared-schemas/package.json /app/packages/shared-schemas/
COPY --from=builder /app/packages/shared-schemas/dist /app/packages/shared-schemas/dist
COPY --from=builder /app/packages/shared-schemas/node_modules /app/packages/shared-schemas/node_modules
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/prisma ./prisma
COPY --from=builder /app/server/public ./public
COPY --from=builder /app/server/setup-network.sh ./

RUN mkdir -p logs && chmod +x setup-network.sh

RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev --ignore-scripts && \
    npx prisma generate

CMD ["node", "dist/server.js"]
