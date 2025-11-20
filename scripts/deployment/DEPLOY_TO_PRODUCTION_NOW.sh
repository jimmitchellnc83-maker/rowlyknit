#!/bin/bash
# Rowly Production Deployment Script
# Run this on your production server at /home/user/rowlyknit

set -e  # Exit on error

echo "🚀 Rowly Production Deployment"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running on production server
if [ ! -d "/home/user/rowlyknit" ]; then
    echo -e "${RED}❌ Error: This script must be run on the production server at /home/user/rowlyknit${NC}"
    echo "Current directory: $(pwd)"
    exit 1
fi

cd /home/user/rowlyknit

echo -e "${YELLOW}📥 Step 1: Pulling latest code...${NC}"
git fetch origin
git checkout claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
echo -e "${GREEN}✅ Code updated${NC}"
echo ""

echo -e "${YELLOW}🔧 Step 2: Checking environment files...${NC}"
if [ ! -f "backend/.env" ]; then
    echo -e "${RED}❌ backend/.env not found${NC}"
    echo "Creating from example..."
    cp backend/.env.production.example backend/.env
    echo -e "${YELLOW}⚠️  Please edit backend/.env with your production secrets${NC}"
    echo "Run: nano backend/.env"
    exit 1
fi

if [ ! -f "frontend/.env.production" ]; then
    echo "Creating frontend/.env.production..."
    cat > frontend/.env.production << 'EOF'
VITE_API_URL=https://api.rowlyknit.com
VITE_APP_NAME=Rowly
VITE_APP_VERSION=1.0.0
VITE_ENABLE_PWA=true
VITE_ENABLE_ANALYTICS=true
EOF
    echo -e "${GREEN}✅ frontend/.env.production created${NC}"
fi
echo ""

echo -e "${YELLOW}🐳 Step 3: Building Docker containers...${NC}"
docker compose build --no-cache
echo -e "${GREEN}✅ Containers built${NC}"
echo ""

echo -e "${YELLOW}🔄 Step 4: Recreating application containers (preserving database)...${NC}"
# Stop and recreate only app containers, preserve postgres and redis volumes
docker compose up -d --force-recreate --no-deps backend frontend nginx
echo -e "${GREEN}✅ Application containers recreated${NC}"
echo ""

echo -e "${YELLOW}🗄️  Step 5: Ensuring database containers are running...${NC}"
docker compose up -d postgres redis
echo -e "${GREEN}✅ Database containers verified${NC}"
echo ""

echo -e "${YELLOW}⏳ Step 6: Waiting for services to be ready...${NC}"
sleep 10
echo ""

echo -e "${YELLOW}🗄️  Step 7: Running database migrations...${NC}"
docker compose exec -T backend npm run migrate
echo -e "${GREEN}✅ Migrations complete${NC}"
echo ""

echo -e "${YELLOW}🏥 Step 8: Health checks...${NC}"
echo "Checking backend..."
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    echo "Check logs: docker compose logs backend"
fi

echo "Checking frontend..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is healthy${NC}"
else
    echo -e "${RED}❌ Frontend health check failed${NC}"
    echo "Check logs: docker compose logs frontend"
fi

echo "Checking nginx..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Nginx is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Nginx health check pending (may need SSL setup)${NC}"
fi
echo ""

echo "📊 Container Status:"
docker compose ps
echo ""

echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo "Your app should be available at:"
echo "  🌐 https://rowlyknit.com"
echo "  🔌 https://api.rowlyknit.com"
echo ""
echo "Useful commands:"
echo "  📊 View logs: docker compose logs -f"
echo "  🔄 Restart: docker compose restart"
echo "  🛑 Stop: docker compose down"
echo "  📈 Status: docker compose ps"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test the site: curl https://rowlyknit.com"
echo "2. Test the API: curl https://api.rowlyknit.com/health"
echo "3. Check logs if any issues: docker compose logs -f"
echo ""
