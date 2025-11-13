#!/bin/bash

# Rowly Production Deployment Script
# Usage: ./deploy.sh

set -e

echo "🚀 Starting Rowly deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/home/user/rowlyknit"
DOCKER_COMPOSE_FILE="$APP_DIR/docker-compose.yml"
BACKUP_DIR="/backups"
ENV_FILE="$APP_DIR/backend/.env"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}.env file not found at $ENV_FILE${NC}"
    echo "Please create .env file from .env.example"
    exit 1
fi

# Pull latest code
echo -e "${YELLOW}📥 Pulling latest code...${NC}"
cd $APP_DIR
BRANCH=${DEPLOY_BRANCH:-claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy}
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

# Create backup
echo -e "${YELLOW}💾 Creating database backup...${NC}"
BACKUP_FILE="$BACKUP_DIR/rowly_$(date +%Y%m%d_%H%M%S).sql"
docker-compose exec -T postgres pg_dump -U $DB_USER $DB_NAME > $BACKUP_FILE
gzip $BACKUP_FILE
echo -e "${GREEN}✓ Backup created: ${BACKUP_FILE}.gz${NC}"

# Stop existing containers
echo -e "${YELLOW}⏹️  Stopping existing containers...${NC}"
docker-compose down

# Pull latest Docker images
echo -e "${YELLOW}📦 Pulling Docker images...${NC}"
docker-compose pull

# Build custom images
echo -e "${YELLOW}🔨 Building application images...${NC}"
docker-compose build --no-cache

# Run database migrations
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
docker-compose run --rm backend npm run migrate

# Start containers
echo -e "${YELLOW}▶️  Starting containers...${NC}"
docker-compose up -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Check service health
echo -e "${YELLOW}🏥 Checking service health...${NC}"

# Check backend health
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is healthy${NC}"
else
    echo -e "${RED}✗ Backend health check failed${NC}"
    docker-compose logs backend
    exit 1
fi

# Check frontend health
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is healthy${NC}"
else
    echo -e "${RED}✗ Frontend health check failed${NC}"
    docker-compose logs frontend
    exit 1
fi

# Check nginx health
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Nginx is healthy${NC}"
else
    echo -e "${RED}✗ Nginx health check failed${NC}"
    docker-compose logs nginx
    exit 1
fi

# Clean up old Docker images
echo -e "${YELLOW}🧹 Cleaning up old Docker images...${NC}"
docker image prune -f

# Clean up old backups (keep last 30 days)
echo -e "${YELLOW}🧹 Cleaning up old backups...${NC}"
find $BACKUP_DIR -name "rowly_*.sql.gz" -mtime +30 -delete

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "🌐 Application is running at https://rowlyknit.com"
echo ""
echo "Useful commands:"
echo "  View logs: docker-compose logs -f"
echo "  Restart: docker-compose restart"
echo "  Stop: docker-compose down"
echo "  View status: docker-compose ps"
