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

RUN corepack enable

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared-schemas/package.json packages/shared-schemas/
COPY server/package.json server/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --filter server...

COPY packages/shared-schemas packages/shared-schemas
COPY server server

RUN pnpm --filter @school/shared-schemas build

WORKDIR /app/server
RUN pnpm run build

# ---------------- RUNTIME STAGE ----------------
FROM runtime-base AS runtime

ENV NODE_ENV=production

RUN corepack enable

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared-schemas/package.json packages/shared-schemas/
COPY server/package.json server/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts --filter server...

COPY --from=builder /app/packages/shared-schemas/dist /app/packages/shared-schemas/dist
COPY --from=builder /app/server/dist /app/server/dist
COPY --from=builder /app/server/prisma /app/server/prisma
COPY --from=builder /app/server/public /app/server/public
COPY --from=builder /app/server/setup-network.sh /app/server/setup-network.sh

WORKDIR /app/server

RUN mkdir -p logs && chmod +x setup-network.sh

RUN pnpm exec prisma generate

CMD ["node", "--import", "./dist/instrument.js", "dist/server.js"]
