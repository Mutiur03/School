#!/bin/bash

# Simple monitoring script for Nginx setup
# Can be used with cron for automated monitoring

# Configuration
ALERT_EMAIL=\"admin@example.com\"
LOG_FILE=\"/var/log/nginx-monitor.log\"

# Load environment
if [ -f .env ]; then
    source .env
fi

# Function to log with timestamp
log_message() {
    echo \"[$(date '+%Y-%m-%d %H:%M:%S')] $1\" | tee -a \"$LOG_FILE\"
}

# Function to send alert (you can customize this)
send_alert() {
    local subject=\"$1\"
    local message=\"$2\"
    
    # Send email alert (requires mail command to be configured)
    # echo \"$message\" | mail -s \"$subject\" \"$ALERT_EMAIL\"
    
    # Or use a webhook, Slack, etc.
    # curl -X POST -H 'Content-type: application/json' --data \"{\\\"text\\\":\\\"$subject: $message\\\"}\" YOUR_WEBHOOK_URL
    
    log_message \"ALERT: $subject - $message\"
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    send_alert \"Docker Down\" \"Docker daemon is not running\"
    exit 1
fi

# Check if containers are running
NGINX_STATUS=$(docker ps --filter \"name=nginx-proxy\" --format \"{{.Status}}\" 2>/dev/null)
CERTBOT_STATUS=$(docker ps --filter \"name=certbot-ssl\" --format \"{{.Status}}\" 2>/dev/null)

if [[ ! \"$NGINX_STATUS\" =~ \"Up\" ]]; then
    send_alert \"Nginx Down\" \"Nginx container is not running\"
fi

if [[ ! \"$CERTBOT_STATUS\" =~ \"Up\" ]]; then
    send_alert \"Certbot Down\" \"Certbot container is not running\"
fi

# Check HTTP to HTTPS redirect
if [ -n \"$DOMAIN\" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w \"%{http_code}\" \"http://$DOMAIN\" 2>/dev/null || echo \"000\")
    if [[ ! \"$HTTP_CODE\" =~ ^(301|302)$ ]]; then
        send_alert \"HTTP Redirect Failed\" \"HTTP to HTTPS redirect not working (Code: $HTTP_CODE)\"
    fi
    
    # Check HTTPS endpoint
    HTTPS_CODE=$(curl -s -k -o /dev/null -w \"%{http_code}\" \"https://$DOMAIN/health\" 2>/dev/null || echo \"000\")
    if [[ ! \"$HTTPS_CODE\" =~ ^2[0-9]{2}$ ]]; then
        send_alert \"HTTPS Health Check Failed\" \"HTTPS endpoint not responding correctly (Code: $HTTPS_CODE)\"
    fi
fi

# Check SSL certificate expiry
if [ -n \"$DOMAIN\" ]; then
    SSL_EXPIRY=$(echo | openssl s_client -servername \"$DOMAIN\" -connect \"$DOMAIN:443\" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep notAfter | cut -d= -f2)
    if [ -n \"$SSL_EXPIRY\" ]; then
        SSL_EXPIRY_EPOCH=$(date -d \"$SSL_EXPIRY\" +%s 2>/dev/null)
        CURRENT_EPOCH=$(date +%s)
        DAYS_UNTIL_EXPIRY=$(( (SSL_EXPIRY_EPOCH - CURRENT_EPOCH) / 86400 ))
        
        if [ \"$DAYS_UNTIL_EXPIRY\" -lt 30 ]; then
            send_alert \"SSL Certificate Expiring\" \"SSL certificate expires in $DAYS_UNTIL_EXPIRY days\"
        fi
    fi
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ \"$DISK_USAGE\" -gt 85 ]; then
    send_alert \"High Disk Usage\" \"Disk usage is at ${DISK_USAGE}%\"
fi

# Check nginx error logs for recent errors
ERROR_COUNT=$(tail -100 nginx/logs/error.log 2>/dev/null | grep \"$(date '+%Y/%m/%d')\" | grep -i error | wc -l)
if [ \"$ERROR_COUNT\" -gt 10 ]; then
    send_alert \"High Error Count\" \"$ERROR_COUNT errors found in today's nginx logs\"
fi

log_message \"Monitor check completed successfully\"