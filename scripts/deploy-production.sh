#!/bin/bash

# Rowly Production Deployment Script
# This script rebuilds and redeploys the production services

set -e  # Exit on error

echo "🚀 Starting Rowly Production Deployment..."
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: docker-compose.yml not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Check if .env files exist
if [ ! -f "backend/.env" ]; then
    echo -e "${RED}Error: backend/.env not found. Please create it from backend/.env.example${NC}"
    exit 1
fi

# Build flags — pass --no-cache as the first arg to force a clean rebuild.
# Otherwise Docker layer cache is reused, skipping npm install when
# package*.json hasn't changed (typical case = ~2 min instead of ~15).
BUILD_FLAGS=""
if [ "$1" = "--no-cache" ]; then
    BUILD_FLAGS="--no-cache"
    echo -e "${YELLOW}🧹 Forced clean rebuild (--no-cache)${NC}"
fi

# Build backend + frontend
echo -e "${YELLOW}🔨 Building services...${NC}"
docker compose build $BUILD_FLAGS backend frontend

# Recreate containers whose images changed; postgres/redis/nginx stay up
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker compose up -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Check service status
echo -e "${YELLOW}📊 Checking service status...${NC}"
docker compose ps

# Test backend health
echo -e "${YELLOW}🏥 Testing backend health...${NC}"
if docker compose exec -T backend wget -q -O - http://localhost:5000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    echo "Checking backend logs:"
    docker compose logs --tail=50 backend
    exit 1
fi

# Show running services
echo ""
echo -e "${GREEN}=========================================="
echo -e "✅ Deployment Complete!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "Services running:"
docker compose ps

echo ""
echo "To view logs:"
echo "  docker compose logs -f backend"
echo "  docker compose logs -f frontend"
echo "  docker compose logs -f nginx"
echo ""
echo "To check backend health:"
echo "  curl http://localhost:5000/health"
echo ""
echo "Frontend should be accessible at: https://rowlyknit.com"
echo "API should be accessible at: https://rowlyknit.com/api"
