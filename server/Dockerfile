# FROM node:22 AS builder
# WORKDIR /app
# COPY package*.json ./
# RUN npm install 
# COPY . .
# # Generate Prisma client at build time so the runtime has the generated client
# RUN npx prisma generate


FROM node:22
RUN apt-get update && apt-get install -y \
    chromium \
    # ca-certificates \
    # fonts-liberation \
    # libnss3 \
    # libxss1 \
    # libasound2 \
    # libatk-bridge2.0-0 \
    # libgtk-3-0 \
    # libx11-xcb1 \
    # libxcomposite1 \
    # libxdamage1 \
    # libxrandr2 \
    # libgbm1 \
    && apt-get clean && apt-get autoremove -y \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# COPY --from=builder /app/package*.json ./
COPY . .
RUN npm install --omit=dev --ignore-scripts
RUN npx prisma generate
# COPY --from=builder /app ./
EXPOSE 3001
CMD ["node", "server.js"]

