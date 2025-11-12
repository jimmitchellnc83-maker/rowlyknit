#!/bin/bash

# SSL/TLS Setup Script for Let's Encrypt
# Usage: ./setup-ssl.sh

set -e

echo "🔒 Setting up SSL/TLS with Let's Encrypt..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
DOMAIN="rowlyknit.com"
EMAIL="admin@rowlyknit.com"
SSL_DIR="/home/user/rowlyknit/deployment/ssl"
CERTBOT_DIR="/var/www/certbot"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Install certbot if not already installed
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}Installing certbot...${NC}"
    apt-get update
    apt-get install -y certbot
fi

# Create directories
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p $SSL_DIR
mkdir -p $CERTBOT_DIR

# Stop nginx temporarily
echo -e "${YELLOW}Stopping nginx...${NC}"
docker-compose stop nginx || true

# Obtain certificate
echo -e "${YELLOW}Obtaining SSL certificate from Let's Encrypt...${NC}"
certbot certonly \
    --standalone \
    --preferred-challenges http \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN

# Copy certificates to ssl directory
echo -e "${YELLOW}Copying certificates...${NC}"
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_DIR/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_DIR/
chmod 644 $SSL_DIR/fullchain.pem
chmod 600 $SSL_DIR/privkey.pem

# Start nginx
echo -e "${YELLOW}Starting nginx...${NC}"
docker-compose up -d nginx

# Setup auto-renewal cron job
echo -e "${YELLOW}Setting up certificate auto-renewal...${NC}"
CRON_SCRIPT="/etc/cron.monthly/renew-ssl"
cat > $CRON_SCRIPT << 'EOF'
#!/bin/bash
certbot renew --quiet --deploy-hook "docker-compose -f /home/user/rowlyknit/docker-compose.yml restart nginx"
EOF

chmod +x $CRON_SCRIPT

echo -e "${GREEN}✅ SSL/TLS setup completed successfully!${NC}"
echo ""
echo "Certificate details:"
certbot certificates
echo ""
echo "Auto-renewal is configured to run monthly via cron."
echo "Test renewal with: certbot renew --dry-run"
