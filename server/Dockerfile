FROM node:22 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install 
COPY . .


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
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app .
EXPOSE 3001
CMD ["node", "server.js"]

