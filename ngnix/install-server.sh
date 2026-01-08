#!/bin/bash

# Complete Server Setup Script for Nginx with SSL
# This script sets up a fresh Ubuntu/Debian server with Docker and this Nginx configuration

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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
if [ "$EUID" -eq 0 ]; then
    error "Please don't run this script as root. Use a user with sudo privileges."
fi

log \"🚀 Starting complete server setup for Nginx with SSL...\"
# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    error "Cannot detect OS. This script supports Ubuntu/Debian systems."
fi

log "💻 Detected OS: $OS $VER"

# Check if OS is supported
if [[ "$OS" != *"Ubuntu"* ]] && [[ "$OS" != *"Debian"* ]]; then
    warn "This script is designed for Ubuntu/Debian. It may not work correctly on $OS."
    echo -n "Do you want to continue anyway? [y/N]: "
    read -n 1 -r REPLY
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Setup cancelled."
        exit 1
    fi
fi
# Update system
log \"📦 Updating system packages...\"
sudo apt update && sudo apt upgrade -y

# Install required packages
log \"📦 Installing required packages...\"
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Install Docker
log \"🐳 Installing Docker...\"
if ! command -v docker &> /dev/null; then
    # Remove any old Docker installations
    sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Install Docker using official script
    curl -fsSL https://get.docker.com -o get-docker.sh
    if [ -f get-docker.sh ]; then
        sh get-docker.sh
        rm get-docker.sh
        
        # Add user to docker group
        sudo usermod -aG docker $USER
        
        # Start and enable Docker service
        sudo systemctl start docker
        sudo systemctl enable docker
        
        log "✅ Docker installed successfully"
    else
        error "Failed to download Docker installation script"
    fi
else
    log "✅ Docker already installed"
    # Ensure user is in docker group
    if ! groups $USER | grep -q docker; then
        sudo usermod -aG docker $USER
        log "Added user to docker group"
    fi
fi

# Install Docker Compose
log \"🐳 Installing Docker Compose...\"
if ! docker compose version &> /dev/null; then
    # Install Docker Compose plugin
    sudo apt update
    sudo apt install -y docker-compose-plugin
    
    # Fallback to standalone installation if plugin fails
    if ! docker compose version &> /dev/null; then
        DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name":' | cut -d'"' -f4)
        sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        # Create alias for docker compose
        echo 'alias docker-compose="docker compose"' >> ~/.bashrc
    fi
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

# Check if nginx configuration exists in current directory first
if [ -f "../ngnix/docker-compose.yml" ] || [ -f "./docker-compose.yml" ]; then
    log "📋 Nginx configuration found in current directory"
    if [ -f "../ngnix/docker-compose.yml" ]; then
        cp -r ../ngnix/* .
    fi
else
    log "📋 Nginx configuration not found locally"
    log "    Please ensure you have the nginx configuration files in this directory"
    log "    You can:"
    log "    1. Copy files manually: cp -r /path/to/ngnix/* ."
    log "    2. Download from repository"
    log "    3. Use scp from another server: scp -r user@server:/path/to/ngnix/* ."
    
    echo -n "Do you want to continue without configuration files? [y/N]: "
    read -n 1 -r REPLY
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Setup cancelled. Please add nginx configuration files and run again."
        exit 1
    fi
fi

# Set up environment
log "⚙️  Setting up environment configuration..."
if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
    warn "Please edit .env file with your domain and configuration"
    warn "Example: nano .env"
fi

# Make scripts executable
if [ -f setup.sh ]; then
    chmod +x *.sh 2>/dev/null || true
    log "✅ Made scripts executable"
else
    warn "setup.sh not found. Some management scripts may not be available."
fi

# Verify essential files exist
ERRORS=0
if [ ! -f docker-compose.yml ]; then
    error "docker-compose.yml not found. Cannot proceed without Docker Compose configuration."
    ERRORS=1
fi

if [ ! -f .env ]; then
    warn ".env file not found. You'll need to create this before running setup.sh"
fi

if [ $ERRORS -eq 1 ]; then
    exit 1
fi

# Create systemd service for auto-start (optional)
log \"📋 Creating systemd service...\"

# Determine which docker compose command to use
DOCKER_COMPOSE_CMD="docker compose"
if command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
fi

sudo tee /etc/systemd/system/nginx-proxy.service > /dev/null <<EOF
[Unit]
Description=Nginx Proxy with SSL
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$(pwd)
ExecStart=/bin/bash -c 'cd $(pwd) && $DOCKER_COMPOSE_CMD up -d'
ExecStop=/bin/bash -c 'cd $(pwd) && $DOCKER_COMPOSE_CMD down'
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
if command -v crontab &> /dev/null; then
    # Create temporary crontab file
    TEMP_CRON=$(mktemp)
    crontab -l 2>/dev/null > "$TEMP_CRON" || echo "# Nginx proxy cron jobs" > "$TEMP_CRON"
    
    # Add new cron jobs if they don't exist
    if ! grep -q "monitor.sh" "$TEMP_CRON"; then
        echo "# Nginx monitoring" >> "$TEMP_CRON"
        echo "*/5 * * * * cd $(pwd) && ./monitor.sh >> monitor.log 2>&1" >> "$TEMP_CRON"
    fi
    
    if ! grep -q "manage.sh backup" "$TEMP_CRON"; then
        echo "# Weekly backup" >> "$TEMP_CRON"
        echo "0 2 * * 0 cd $(pwd) && ./manage.sh backup" >> "$TEMP_CRON"
    fi
    
    if ! grep -q "ssl-renew" "$TEMP_CRON"; then
        echo "# Daily SSL renewal check" >> "$TEMP_CRON"
        echo "0 12 * * * cd $(pwd) && ./manage.sh ssl-renew >> ssl-renew.log 2>&1" >> "$TEMP_CRON"
    fi
    
    # Install the new crontab
    crontab "$TEMP_CRON"
    rm "$TEMP_CRON"
    log "✅ Cron jobs configured"
else
    warn "Crontab not available, skipping automated tasks setup"
fi

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
    log "⚠️  Adding user to docker group..."
    sudo usermod -aG docker $USER
    warn "⚠️  You need to log out and log back in (or run 'newgrp docker') for Docker group changes to take effect"
    log "    After logging back in, you can test with: docker ps"
fi

log "🎉 Setup script completed!"
log "\n📋 Important: If this is your first time installing Docker, please:"
log "    1. Log out and log back in (or run 'newgrp docker')"
log "    2. Test Docker access: docker ps"
log "    3. Then proceed with nginx setup"