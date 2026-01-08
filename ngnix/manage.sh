#!/bin/bash

# Nginx Management Script
# Usage: ./manage.sh [command]

set -e

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

log() {
    echo -e \"${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1\"
}

warn() {
    echo -e \"${YELLOW}[WARNING]${NC} $1\"
}

error() {
    echo -e \"${RED}[ERROR]${NC} $1\"
    exit 1
}

# Check if .env exists
if [ ! -f .env ]; then
    error \".env file not found! Please run setup.sh first.\"
fi

source .env

case \"$1\" in
    \"start\")
        log \"🚀 Starting Nginx services...\"
        docker compose up -d
        log \"✅ Services started\"
        ;;
    \"stop\")
        log \"⏹️  Stopping Nginx services...\"
        docker compose down
        log \"✅ Services stopped\"
        ;;
    \"restart\")
        log \"🔄 Restarting Nginx services...\"
        docker compose restart
        log \"✅ Services restarted\"
        ;;
    \"status\")
        log \"📊 Service Status:\"
        docker compose ps
        echo
        log \"🔍 Container Health:\"
        docker ps --format \"table {{.Names}}\\t{{.Status}}\\t{{.Ports}}\"
        ;;
    \"logs\")
        log \"📋 Showing logs (Ctrl+C to exit):\"
        docker compose logs -f \"${2:-}\"
        ;;
    \"ssl-renew\")
        log \"🔐 Renewing SSL certificates...\"
        docker compose run --rm certbot renew
        docker compose exec nginx nginx -s reload
        log \"✅ SSL certificates renewed\"
        ;;
    \"ssl-status\")
        log \"📜 SSL Certificate Status:\"
        docker compose run --rm certbot certificates
        ;;
    \"test\")
        log \"🧪 Testing Nginx configuration...\"
        docker compose exec nginx nginx -t
        log \"✅ Configuration test passed\"
        ;;
    \"reload\")
        log \"🔄 Reloading Nginx configuration...\"
        docker compose exec nginx nginx -s reload
        log \"✅ Configuration reloaded\"
        ;;
    \"backup\")
        BACKUP_DIR=\"./backups/$(date +%Y%m%d_%H%M%S)\"
        log \"💾 Creating backup in $BACKUP_DIR...\"
        mkdir -p \"$BACKUP_DIR\"
        cp -r ./nginx/ \"$BACKUP_DIR/\"
        cp -r ./certbot/ \"$BACKUP_DIR/\"
        cp .env \"$BACKUP_DIR/\"
        cp docker-compose.yml \"$BACKUP_DIR/\"
        log \"✅ Backup created in $BACKUP_DIR\"
        ;;
    \"clean\")
        log \"🧹 Cleaning up unused Docker resources...\"
        docker system prune -f
        log \"✅ Cleanup completed\"
        ;;
    \"health\")
        log \"🏥 Checking service health...\"
        
        # Check HTTP redirect
        if curl -s -o /dev/null -w \"%{http_code}\" http://$DOMAIN | grep -q \"301\\|302\"; then
            log \"✅ HTTP to HTTPS redirect: OK\"
        else
            warn \"❌ HTTP to HTTPS redirect: FAILED\"
        fi
        
        # Check HTTPS
        if curl -s -k https://$DOMAIN/health >/dev/null 2>&1; then
            log \"✅ HTTPS endpoint: OK\"
        else
            warn \"❌ HTTPS endpoint: FAILED\"
        fi
        
        # Check SSL certificate
        if openssl s_client -connect $DOMAIN:443 -servername $DOMAIN </dev/null 2>/dev/null | openssl x509 -noout -dates 2>/dev/null; then
            log \"✅ SSL Certificate: OK\"
        else
            warn \"❌ SSL Certificate: FAILED\"
        fi
        ;;
    \"update\")
        log \"📦 Updating Docker images...\"
        docker compose pull
        docker compose up -d
        log \"✅ Update completed\"
        ;;
    \"help\"|\"--help\"|\"-h\"|*)
        echo -e \"${BLUE}Nginx Management Script${NC}\"
        echo
        echo \"Usage: ./manage.sh [command]\"
        echo
        echo \"Commands:\"
        echo \"  start      - Start all services\"
        echo \"  stop       - Stop all services\"
        echo \"  restart    - Restart all services\"
        echo \"  status     - Show service status\"
        echo \"  logs       - Show logs (optional: specify service name)\"
        echo \"  ssl-renew  - Renew SSL certificates\"
        echo \"  ssl-status - Show SSL certificate status\"
        echo \"  test       - Test Nginx configuration\"
        echo \"  reload     - Reload Nginx configuration\"
        echo \"  backup     - Create backup of configuration\"
        echo \"  clean      - Clean unused Docker resources\"
        echo \"  health     - Check service health\"
        echo \"  update     - Update Docker images\"
        echo \"  help       - Show this help message\"
        echo
        echo \"Examples:\"
        echo \"  ./manage.sh start\"
        echo \"  ./manage.sh logs nginx\"
        echo \"  ./manage.sh ssl-renew\"
        ;;
esac