#!/bin/bash

set -e

if [ ! -f .env ]; then
  echo ".env file missing!"
  exit 1
fi

source .env

echo "🚀 Starting Nginx for domain: $DOMAIN"

# Start nginx only (HTTP)
docker compose up -d nginx

echo "🔐 Requesting SSL certificate..."
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email $EMAIL \
  --agree-tos \
  --no-eff-email \
  -d $DOMAIN

echo "♻ Restarting services with SSL..."
docker compose down
docker compose up -d

echo "✅ SSL enabled for https://$DOMAIN"
