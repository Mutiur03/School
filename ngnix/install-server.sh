#!/bin/bash

# Complete Server Setup Script for Nginx with SSL
# This script sets up a fresh Ubuntu/Debian server with Docker and this Nginx configuration

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

# Check if running as root
if [ \"$EUID\" -eq 0 ]; then
    error \"Please don't run this script as root. Use a user with sudo privileges.\"
fi

log \"🚀 Starting complete server setup for Nginx with SSL...\"

# Update system
log \"📦 Updating system packages...\"
sudo apt update && sudo apt upgrade -y

# Install required packages
log \"📦 Installing required packages...\"
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Install Docker
log \"🐳 Installing Docker...\"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    log \"✅ Docker installed successfully\"
else
    log \"✅ Docker already installed\"
fi

# Install Docker Compose
log \"🐳 Installing Docker Compose...\"
if ! command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '\"tag_name\":' | cut -d'\"' -f4)
    sudo curl -L \"https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)\" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    log \"✅ Docker Compose installed successfully\"
else
    log \"✅ Docker Compose already installed\"
fi

# Install additional useful tools
log \"🛠️  Installing additional tools...\"
sudo apt install -y htop ncdu tree jq

# Configure firewall
log \"🔥 Configuring UFW firewall...\"
if command -v ufw &> /dev/null; then
    sudo ufw --force enable
    sudo ufw allow ssh
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw reload
    log \"✅ Firewall configured\"
else
    warn \"UFW not available, skipping firewall configuration\"
fi

# Create nginx directory structure
log \"📁 Creating nginx directory structure...\"
mkdir -p ~/nginx-setup
cd ~/nginx-setup

# Download or copy nginx configuration
# If you're running this on the same machine, we'll copy the config
if [ -d \"/mnt/E6863BD9863BA947/Projects/School/ngnix\" ]; then
    log \"📋 Copying nginx configuration from local directory...\"
    cp -r /mnt/E6863BD9863BA947/Projects/School/ngnix/* .
else
    log \"📋 Please copy your nginx configuration to $(pwd)\"
    log \"    You can use: scp -r local/ngnix/* user@server:$(pwd)/\"
fi

# Set up environment
log \"⚙️  Setting up environment configuration...\"
if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
    warn \"Please edit .env file with your domain and configuration\"
    warn \"Example: nano .env\"
fi

# Make scripts executable
if [ -f setup.sh ]; then
    chmod +x *.sh
fi

# Create systemd service for auto-start (optional)
log \"📋 Creating systemd service...\"
sudo tee /etc/systemd/system/nginx-proxy.service > /dev/null <<EOF
[Unit]
Description=Nginx Proxy with SSL
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$(pwd)
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable nginx-proxy.service

# Create logrotate configuration
log \"📋 Setting up log rotation...\"
sudo tee /etc/logrotate.d/nginx-proxy > /dev/null <<EOF
$(pwd)/nginx/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        docker exec nginx-proxy nginx -s reload 2>/dev/null || true
    endscript
}
EOF

# Set up cron jobs for monitoring and SSL renewal
log \"📋 Setting up cron jobs...\"
(crontab -l 2>/dev/null; echo \"# Nginx monitoring\") | crontab -
(crontab -l 2>/dev/null; echo \"*/5 * * * * cd $(pwd) && ./monitor.sh >> monitor.log 2>&1\") | crontab -
(crontab -l 2>/dev/null; echo \"# Weekly backup\") | crontab -
(crontab -l 2>/dev/null; echo \"0 2 * * 0 cd $(pwd) && ./manage.sh backup\") | crontab -
(crontab -l 2>/dev/null; echo \"# Daily SSL renewal check\") | crontab -
(crontab -l 2>/dev/null; echo \"0 12 * * * cd $(pwd) && ./manage.sh ssl-renew >> ssl-renew.log 2>&1\") | crontab -

# Create directory for backups
mkdir -p backups

log \"✅ Server setup completed successfully!\"
echo
log \"📋 Next steps:\"
echo \"  1. Edit .env file with your domain and configuration:\"
echo \"     nano .env\"
echo \"  2. Start the nginx setup:\"
echo \"     ./setup.sh\"
echo \"  3. Check the status:\"
echo \"     ./manage.sh status\"
echo \"  4. Verify health:\"
echo \"     ./manage.sh health\"
echo
log \"📁 Current directory: $(pwd)\"
log \"📖 Read README.md for detailed documentation\"

# Check if user needs to log out for Docker group changes
if groups $USER | grep -q docker; then
    log \"✅ User already in docker group\"
else
    warn \"⚠️  You may need to log out and log back in for Docker group changes to take effect\"
fi

log \"🎉 Setup script completed!\"