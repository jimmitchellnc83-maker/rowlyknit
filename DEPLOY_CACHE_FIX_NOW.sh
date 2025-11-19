#!/bin/bash
# Deploy Cache Fix for React useState Error
# Run this on your production server

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Deploying Cache Fix for React Error${NC}"
echo "=========================================="
echo ""

# Check if running on production server
if [ ! -d "/home/user/rowlyknit" ]; then
    echo -e "${RED}❌ Error: Run this script on your production server${NC}"
    exit 1
fi

cd /home/user/rowlyknit

echo -e "${YELLOW}📥 Step 1: Pulling latest changes...${NC}"
git fetch origin
git checkout claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
echo -e "${GREEN}✅ Code updated${NC}"
echo ""

echo -e "${YELLOW}🐳 Step 2: Rebuilding frontend container...${NC}"
docker compose build --no-cache frontend
echo -e "${GREEN}✅ Frontend rebuilt with cache fixes${NC}"
echo ""

echo -e "${YELLOW}🔄 Step 3: Stopping containers...${NC}"
docker compose stop frontend nginx
echo -e "${GREEN}✅ Containers stopped${NC}"
echo ""

echo -e "${YELLOW}🗑️  Step 4: Removing old containers...${NC}"
docker compose rm -f frontend nginx
echo -e "${GREEN}✅ Old containers removed${NC}"
echo ""

echo -e "${YELLOW}🚀 Step 5: Starting fresh containers...${NC}"
docker compose up -d frontend nginx
echo -e "${GREEN}✅ Services restarted${NC}"
echo ""

echo -e "${YELLOW}⏳ Step 6: Waiting for services to stabilize...${NC}"
sleep 5
echo ""

echo -e "${YELLOW}🏥 Step 7: Health checks...${NC}"
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is healthy${NC}"
else
    echo -e "${RED}❌ Frontend health check failed${NC}"
    echo "Check logs: docker compose logs frontend"
    exit 1
fi

if curl -f http://localhost/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Nginx is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Nginx health check warning${NC}"
fi
echo ""

echo "📊 Container Status:"
docker compose ps
echo ""

echo -e "${GREEN}🎉 Cache Fix Deployed Successfully!${NC}"
echo ""
echo -e "${YELLOW}What was fixed:${NC}"
echo "  ✅ index.html now never caches (always fresh)"
echo "  ✅ Service worker files never cache"
echo "  ✅ Manifest files cache for 1 hour only"
echo "  ✅ Service worker auto-cleans old caches"
echo "  ✅ Static assets still cached for 1 year (with hashes)"
echo ""
echo -e "${YELLOW}For users with cached errors:${NC}"
echo "  Tell them to hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)"
echo "  Or clear browser cache completely"
echo ""
echo "Test the fix at: https://rowlyknit.com"
echo ""
