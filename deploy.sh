#!/bin/bash
set -e

echo "🚀 Starting Rowly deployment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pull latest code
echo -e "${BLUE}📥 Pulling latest code...${NC}"
cd "$PROJECT_DIR"
git pull origin main

# Backend
echo -e "${BLUE}📦 Building backend...${NC}"
cd "$PROJECT_DIR/backend"
npm ci --only=production
npm run build

# Frontend
echo -e "${BLUE}🎨 Building frontend...${NC}"
cd "$PROJECT_DIR/frontend"
npm ci
npm run build

# Run migrations
echo -e "${BLUE}🗄️  Running database migrations...${NC}"
cd "$PROJECT_DIR/backend"
npm run migrate

# Restart services
echo -e "${BLUE}♻️  Restarting services...${NC}"
pm2 restart rowly-backend

# Reload Nginx
echo -e "${BLUE}🌐 Reloading Nginx...${NC}"
sudo systemctl reload nginx

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${BLUE}🔍 Checking status...${NC}"
pm2 status
