# ---------------- BASE IMAGE ----------------
FROM node:22-bookworm-slim

# Set working directory
WORKDIR /app

# Install minimal dependencies for Playwright Chromium
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
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Install pnpm globally for smaller node_modules
RUN npm install -g pnpm

# Copy package files for caching
COPY package*.json ./

# Install production dependencies only
RUN pnpm install --prod --ignore-scripts

RUN npm install pm2 -g

# Copy the rest of the app
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Optional: remove unnecessary Prisma engines to save space (~50MB)
RUN rm -rf node_modules/.prisma/client/libquery_engine-* \
    && rm -rf node_modules/.prisma/client/libschema_engine-*

# Expose port
EXPOSE 3001

# Start server
CMD ["pm2-runtime", "index.js", "-i", "max"]
