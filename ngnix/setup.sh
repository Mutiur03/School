#!/bin/bash

set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Logging function
log() {
    echo -e \"${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1\"
}

warn() {
    echo -e \"${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1\"
}

error() {
    echo -e \"${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1\"
    exit 1
}

# Check if .env file exists
if [ ! -f .env ]; then
    error \".env file missing! Please copy .env.example to .env and configure it.\"
fi

# Load environment variables
source .env

# Validate required environment variables
if [ -z \"$DOMAIN\" ]; then
    error \"DOMAIN is not set in .env file\"
fi

if [ -z \"$EMAIL\" ]; then
    error \"EMAIL is not set in .env file\"
fi

log \"🚀 Starting Nginx setup for domain: $DOMAIN\"

# Create necessary directories
log \"📁 Creating directories...\"
mkdir -p ./nginx/logs
mkdir -p ./certbot/www
mkdir -p ./certbot/conf
mkdir -p ./static
mkdir -p ./nginx/ssl

# Set proper permissions
chmod 755 ./nginx/logs
chmod 755 ./static

# Start nginx in HTTP mode first
log \"🌐 Starting Nginx in HTTP mode...\"
docker compose up -d nginx

# Wait for nginx to be ready
sleep 10

# Check if nginx is running
if ! docker ps | grep -q nginx-proxy; then
    error \"Nginx failed to start\"
fi

log \"🔐 Requesting SSL certificate for $DOMAIN...\"

# Request SSL certificate
if docker compose run --rm certbot certonly \\
    --webroot \\
    --webroot-path=/var/www/certbot \\
    --email $EMAIL \\
    --agree-tos \\
    --no-eff-email \\
    --force-renewal \\
    -d $DOMAIN; then
    log \"✅ SSL certificate obtained successfully\"
else
    error \"Failed to obtain SSL certificate\"
fi

# Request certificates for additional domains if specified
if [ -n \"$ADDITIONAL_DOMAINS\" ]; then
    IFS=',' read -ra DOMAINS <<< \"$ADDITIONAL_DOMAINS\"
    for domain in \"${DOMAINS[@]}\"; do
        domain=$(echo $domain | xargs) # trim whitespace
        if [ -n \"$domain\" ]; then
            log \"🔐 Requesting SSL certificate for additional domain: $domain...\"
            docker compose run --rm certbot certonly \\
                --webroot \\
                --webroot-path=/var/www/certbot \\
                --email $EMAIL \\
                --agree-tos \\
                --no-eff-email \\
                --force-renewal \\
                -d $domain
        fi
    done
fi

log \"♻️  Restarting services with SSL...\"
docker compose down
docker compose up -d

# Wait for services to be ready
sleep 15

# Test the setup
log \"🧪 Testing the setup...\"

# Check if services are running
if docker ps | grep -q nginx-proxy && docker ps | grep -q certbot-ssl; then
    log \"✅ All services are running\"
else
    error \"Some services failed to start\"
fi

# Test HTTP redirect
if curl -s -o /dev/null -w \"%{http_code}\" http://$DOMAIN | grep -q \"301\\|302\"; then
    log \"✅ HTTP to HTTPS redirect is working\"
else
    warn \"HTTP to HTTPS redirect might not be working properly\"
fi

# Test HTTPS
if curl -s -k https://$DOMAIN/health | grep -q \"healthy\"; then
    log \"✅ HTTPS health check passed\"
else
    warn \"HTTPS health check failed - your backend might not be running\"
fi

log \"🎉 Setup completed successfully!\"
log \"📊 Your site should be accessible at: https://$DOMAIN\"
log \"📋 Check logs with: docker compose logs -f\"
log \"🔄 Restart services with: docker compose restart\"

# Show running containers
log \"\\n📦 Running containers:\"
docker ps --format \"table {{.Names}}\\t{{.Status}}\\t{{.Ports}}\"

log \"\\n📜 SSL certificate status:\"
docker compose run --rm certbot certificates