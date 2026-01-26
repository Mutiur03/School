# ---------------- BASE IMAGE ----------------
FROM node:22-bookworm-slim

# Set working directory
WORKDIR /app

# Install minimal dependencies for Playwright Chromium and system utilities
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

# Install pnpm globally for smaller node_modules
RUN npm install -g pnpm

# Copy package files for caching
COPY package*.json ./

# Install production dependencies only
RUN pnpm install --prod --ignore-scripts

RUN npm install pm2 -g

# Copy the rest of the app
COPY . .

# Make the startup script executable
RUN chmod +x setup-network.sh
# Build application (Prisma client generation)
RUN npx prisma generate

# Final cleanup
RUN pnpm prune --prod

# Clear any entrypoint from the base image
ENTRYPOINT []

# Start the application directly
CMD ["node", "server.js"]
