#!/bin/bash

# ============================================
# Rowly Docker Production Deployment
# ============================================
# Quick deployment script for Docker-based production setup

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/home/user/rowlyknit"
BRANCH="claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy"

print_header() {
    echo -e "\n${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# ============================================
# Pre-flight Checks
# ============================================

print_header "Rowly Docker Production Deployment"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    print_info "Install Docker: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not available"
    print_info "Install Docker Compose V2 or use docker-compose"
    exit 1
fi

print_success "Docker is available"

# ============================================
# Update Code
# ============================================

print_header "Updating Code"

cd $APP_DIR

# Check if we're on the right branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    print_warning "Current branch: $CURRENT_BRANCH"
    print_info "Switching to: $BRANCH"
    git fetch origin
    git checkout $BRANCH
fi

# Pull latest changes
print_info "Pulling latest code..."
git pull origin $BRANCH

print_success "Code updated"

# ============================================
# Environment Files
# ============================================

print_header "Checking Environment Files"

# Backend .env
if [ -f "$APP_DIR/backend/.env" ]; then
    print_success "Backend .env exists"

    if grep -q "CHANGE" "$APP_DIR/backend/.env" 2>/dev/null; then
        print_warning "Backend .env contains CHANGE_ME placeholders"
        echo "  Please update: nano $APP_DIR/backend/.env"
        read -p "Press enter when ready to continue..."
    else
        print_success "Backend .env appears configured"
    fi
else
    print_warning "Backend .env not found"
    if [ -f "$APP_DIR/backend/.env.production.example" ]; then
        print_info "Copying from example..."
        cp "$APP_DIR/backend/.env.production.example" "$APP_DIR/backend/.env"
        print_warning "Please configure: nano $APP_DIR/backend/.env"
        read -p "Press enter when ready to continue..."
    else
        print_error "No example file found!"
        exit 1
    fi
fi

# Frontend .env.production
if [ -f "$APP_DIR/frontend/.env.production" ]; then
    print_success "Frontend .env.production exists"
else
    print_warning "Frontend .env.production not found"
    if [ -f "$APP_DIR/frontend/.env.production.example" ]; then
        print_info "Copying from example..."
        cp "$APP_DIR/frontend/.env.production.example" "$APP_DIR/frontend/.env.production"
        print_success "Frontend .env.production created"
    else
        print_error "No example file found!"
        exit 1
    fi
fi

# ============================================
# Docker Deployment
# ============================================

print_header "Building and Deploying Containers"

cd $APP_DIR

# Stop existing containers
print_info "Stopping existing containers..."
docker compose down

# Build containers
print_info "Building containers (this may take a few minutes)..."
docker compose build

# Start containers
print_info "Starting containers..."
docker compose up -d

# Wait for containers to be healthy
print_info "Waiting for containers to be healthy..."
sleep 10

# Check container status
print_info "Container status:"
docker compose ps

# ============================================
# Run Migrations
# ============================================

print_header "Running Database Migrations"

# Wait a bit more for database to be fully ready
sleep 5

# Run migrations
print_info "Running migrations..."
if docker compose exec -T backend npm run migrate; then
    print_success "Migrations completed"
else
    print_warning "Migration may have failed, check logs: docker compose logs backend"
fi

# ============================================
# Health Checks
# ============================================

print_header "Running Health Checks"

# Wait for services to start
sleep 5

# Check backend
print_info "Checking backend..."
if curl -f -s http://localhost:5000/health > /dev/null 2>&1; then
    print_success "Backend is healthy"
else
    print_warning "Backend health check failed"
    print_info "Check logs: docker compose logs backend"
fi

# Check frontend
print_info "Checking frontend..."
if curl -f -s http://localhost:3000 > /dev/null 2>&1; then
    print_success "Frontend is accessible"
else
    print_warning "Frontend check failed"
    print_info "Check logs: docker compose logs frontend"
fi

# Check PostgreSQL
print_info "Checking PostgreSQL..."
if docker compose exec -T postgres pg_isready -U rowly_user > /dev/null 2>&1; then
    print_success "PostgreSQL is ready"
else
    print_warning "PostgreSQL check failed"
fi

# Check Redis
print_info "Checking Redis..."
if docker compose exec -T redis redis-cli -a "$(grep REDIS_PASSWORD backend/.env | cut -d'=' -f2)" ping > /dev/null 2>&1; then
    print_success "Redis is ready"
else
    print_warning "Redis check failed"
fi

# ============================================
# Summary
# ============================================

print_header "Deployment Complete!"

echo -e "${GREEN}✓ Application deployed successfully${NC}\n"

print_info "Your application is now running:"
echo "  • Frontend: http://localhost:3000"
echo "  • Backend:  http://localhost:5000"
echo "  • Health:   http://localhost:5000/health"
echo ""
print_info "Public URLs (via nginx reverse proxy):"
echo "  • https://rowlyknit.com"
echo "  • https://www.rowlyknit.com"
echo "  • https://api.rowlyknit.com"
echo "  • https://api.rowlyknit.com/health"
echo ""

print_info "Useful commands:"
echo "  View logs:       docker compose logs -f"
echo "  Restart:         docker compose restart"
echo "  Stop:            docker compose down"
echo "  Status:          docker compose ps"
echo "  Backend shell:   docker compose exec backend sh"
echo "  Database shell:  docker compose exec postgres psql -U rowly_user -d rowly_production"
echo ""

print_info "Check logs now?"
read -p "View logs? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker compose logs --tail=50
fi

echo -e "\n${GREEN}🎉 Deployment complete!${NC}\n"
