#!/bin/bash

# Rowly Server Setup Script for Digital Ocean Ubuntu 25.10
# Usage: ./server-setup.sh

set -e

echo "🖥️  Setting up Rowly production server..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Update system
echo -e "${YELLOW}📦 Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

# Install essential packages
echo -e "${YELLOW}📦 Installing essential packages...${NC}"
apt-get install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    ufw \
    fail2ban \
    unattended-upgrades \
    ca-certificates \
    gnupg \
    lsb-release

# Install Docker
echo -e "${YELLOW}🐳 Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Set up repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Start and enable Docker
    systemctl start docker
    systemctl enable docker

    echo -e "${GREEN}✓ Docker installed successfully${NC}"
else
    echo -e "${GREEN}✓ Docker already installed${NC}"
    docker --version
fi

# Install Docker Compose (standalone)
echo -e "${YELLOW}🐳 Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_VERSION="v2.24.0"
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓ Docker Compose installed successfully${NC}"
else
    echo -e "${GREEN}✓ Docker Compose already installed${NC}"
    docker-compose --version
fi

# Configure firewall
echo -e "${YELLOW}🔥 Configuring firewall...${NC}"
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw reload
echo -e "${GREEN}✓ Firewall configured${NC}"

# Configure fail2ban
echo -e "${YELLOW}🛡️  Configuring fail2ban...${NC}"
systemctl enable fail2ban
systemctl start fail2ban
echo -e "${GREEN}✓ fail2ban configured${NC}"

# Enable automatic security updates
echo -e "${YELLOW}🔒 Enabling automatic security updates...${NC}"
cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

systemctl enable unattended-upgrades
systemctl start unattended-upgrades
echo -e "${GREEN}✓ Automatic security updates enabled${NC}"

# Create application directories
echo -e "${YELLOW}📁 Creating application directories...${NC}"
mkdir -p /home/user/rowlyknit
mkdir -p /backups
mkdir -p /var/log/rowly
mkdir -p /home/user/rowlyknit/backend/uploads

# Set proper permissions
chown -R 1001:1001 /home/user/rowlyknit/backend/uploads
chown -R 1001:1001 /var/log/rowly
chmod -R 755 /home/user/rowlyknit
chmod -R 755 /backups

echo -e "${GREEN}✓ Directories created${NC}"

# Install systemd service
echo -e "${YELLOW}⚙️  Installing systemd service...${NC}"
if [ -f "/home/user/rowlyknit/deployment/systemd/rowly.service" ]; then
    cp /home/user/rowlyknit/deployment/systemd/rowly.service /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable rowly.service
    echo -e "${GREEN}✓ Systemd service installed${NC}"
else
    echo -e "${YELLOW}⚠️  Systemd service file not found. Will be installed after repository clone.${NC}"
fi

# Configure log rotation
echo -e "${YELLOW}📝 Configuring log rotation...${NC}"
cat > /etc/logrotate.d/rowly << 'EOF'
/var/log/rowly/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 1001 1001
    sharedscripts
    postrotate
        docker-compose -f /home/user/rowlyknit/docker-compose.yml restart backend 2>/dev/null || true
    endscript
}
EOF
echo -e "${GREEN}✓ Log rotation configured${NC}"

# Setup backup cron job
echo -e "${YELLOW}⏰ Setting up automated backups...${NC}"
cat > /etc/cron.hourly/rowly-backup << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker-compose -f /home/user/rowlyknit/docker-compose.yml exec -T postgres \
    pg_dump -U rowly_user rowly_production > "$BACKUP_DIR/rowly_$TIMESTAMP.sql" 2>/dev/null
gzip "$BACKUP_DIR/rowly_$TIMESTAMP.sql"
# Delete backups older than 30 days
find "$BACKUP_DIR" -name "rowly_*.sql.gz" -mtime +30 -delete
EOF

chmod +x /etc/cron.hourly/rowly-backup
echo -e "${GREEN}✓ Automated backups configured${NC}"

# Optimize system for production
echo -e "${YELLOW}⚡ Optimizing system settings...${NC}"

# Increase file descriptor limits
cat >> /etc/security/limits.conf << 'EOF'
* soft nofile 65536
* hard nofile 65536
EOF

# Optimize sysctl settings
cat >> /etc/sysctl.conf << 'EOF'
# Increase connection tracking table sizes
net.netfilter.nf_conntrack_max = 262144

# Improve network performance
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 30

# Increase maximum number of memory map areas
vm.max_map_count = 262144
EOF

sysctl -p
echo -e "${GREEN}✓ System optimizations applied${NC}"

# Print summary
echo ""
echo -e "${GREEN}✅ Server setup completed successfully!${NC}"
echo ""
echo "==================================="
echo "Next steps:"
echo "==================================="
echo "1. Clone the repository:"
echo "   cd /home/user && git clone <repository-url> rowlyknit"
echo ""
echo "2. Create .env file:"
echo "   cd /home/user/rowlyknit/backend"
echo "   cp .env.example .env"
echo "   nano .env  # Edit with your production values"
echo ""
echo "3. Setup SSL certificates:"
echo "   cd /home/user/rowlyknit/deployment/scripts"
echo "   chmod +x setup-ssl.sh"
echo "   ./setup-ssl.sh"
echo ""
echo "4. Deploy the application:"
echo "   chmod +x deploy.sh"
echo "   ./deploy.sh"
echo ""
echo "5. Start the systemd service:"
echo "   systemctl start rowly"
echo "   systemctl status rowly"
echo ""
echo "==================================="
echo "Installed versions:"
echo "==================================="
docker --version
docker-compose --version
echo ""
echo "Server IP: 165.227.97.4"
echo "Domain: rowlyknit.com"
echo "==================================="
