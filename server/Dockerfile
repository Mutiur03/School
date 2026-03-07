# ---------------- BUILD STAGE ----------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app
RUN npm install -g pnpm

# Copy package manifests for dependency caching
COPY server/package*.json /app/server/
COPY packages/shared-schemas /app/packages/shared-schemas

# Install all dependencies for building
WORKDIR /app/server
RUN pnpm install --ignore-scripts

# Copy source files
COPY server /app/server
COPY packages/shared-schemas /app/packages/shared-schemas

# Generate Prisma client and compile TypeScript
RUN npx prisma generate
RUN npm run build

# ---------------- RUNTIME STAGE ----------------
FROM node:22-bookworm-slim

WORKDIR /app/server

# Install minimal dependencies for Puppeteer and system utilities
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    wget \
    curl \
    netcat-traditional \
    postgresql-client \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Install pnpm and pm2 for production management
RUN npm install -g pnpm pm2

# Copy built assets and production manifests from the builder stage
COPY --from=builder /app/server/package*.json ./
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/prisma ./prisma
COPY --from=builder /app/server/setup-network.sh ./
COPY --from=builder /app/packages/shared-schemas /app/packages/shared-schemas

# Install only production dependencies
RUN pnpm install --prod --ignore-scripts

# Make startup script executable and set launch command
RUN chmod +x setup-network.sh
ENTRYPOINT []

# Start using the compiled output
CMD ["node", "dist/server.js"]