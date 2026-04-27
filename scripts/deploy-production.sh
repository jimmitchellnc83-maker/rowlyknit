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

# OOM-safe build sequence.
#
# The frontend build is heavy (~1.5 GB heap for tesseract.js + zxing under
# V8; see frontend/Dockerfile's NODE_OPTIONS bump from PR #107). On our 2 GB
# droplet, running that build alongside the *existing* frontend + backend +
# postgres + redis + nginx containers pushed the host into swap-thrashing
# territory — sshd and nginx stopped completing handshakes and the droplet
# had to be power-cycled on 2026-04-23 after two failed deploys.
#
# Fix: stop the frontend container before building so ~300 MB of RAM comes
# back to the build process. The existing image keeps serving nginx-cached
# assets via the running `rowly_nginx` reverse proxy (it'll 502 briefly on
# origin requests — ~2 min of downtime is acceptable for a deploy). When
# the build finishes, `docker compose up -d` brings the new frontend up.
#
# If droplet RAM ever grows past ~4 GB we can simplify back to a pure
# build-then-up flow without the stop step.
echo -e "${YELLOW}🛑 Stopping frontend container to free RAM for the build...${NC}"
docker compose stop frontend

echo -e "${YELLOW}🔨 Building services...${NC}"
docker compose build $BUILD_FLAGS backend frontend

# Recreate containers whose images changed; postgres/redis/nginx stay up.
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker compose up -d

# Show service status for log visibility
echo -e "${YELLOW}📊 Service status:${NC}"
docker compose ps

# Backend cold-start on this droplet takes ~13s. The previous `sleep 10`
# + single wget exited 1 right as the backend reported "still starting,"
# producing a false-fail in the GitHub Actions auto-deploy. Poll instead.
echo -e "${YELLOW}🏥 Waiting for backend to report healthy (up to 60s)...${NC}"
deadline=$((SECONDS + 60))
while (( SECONDS < deadline )); do
    if docker compose exec -T backend wget -q -O - http://localhost:5000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
        break
    fi
    sleep 2
done

if (( SECONDS >= deadline )); then
    echo -e "${RED}❌ Backend health check failed after 60s${NC}"
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
