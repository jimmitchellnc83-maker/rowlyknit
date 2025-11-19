#!/bin/bash

# ============================================
# Rowly Production Quick Setup Helper
# ============================================
# This script helps you complete the remaining setup steps

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "\n${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

APP_DIR="/home/user/rowlyknit"

print_step "Checking Environment Files"

# Check backend .env
if [ -f "$APP_DIR/backend/.env" ]; then
    print_success "Backend .env exists"

    # Check if critical values are configured
    if grep -q "CHANGE_ME" "$APP_DIR/backend/.env"; then
        print_warning "Backend .env contains CHANGE_ME placeholders - please update:"
        echo "  nano $APP_DIR/backend/.env"
    else
        print_success "Backend .env appears configured"
    fi
else
    print_warning "Backend .env not found. Creating from example..."
    cp "$APP_DIR/backend/.env.production.example" "$APP_DIR/backend/.env"
    echo "  Please edit: nano $APP_DIR/backend/.env"
fi

# Check frontend .env.production
if [ -f "$APP_DIR/frontend/.env.production" ]; then
    print_success "Frontend .env.production exists"
else
    print_warning "Frontend .env.production not found. Creating from example..."
    cp "$APP_DIR/frontend/.env.production.example" "$APP_DIR/frontend/.env.production"
    print_success "Frontend .env.production created with defaults"
fi

print_step "Checking Services"

# PostgreSQL
if systemctl is-active --quiet postgresql; then
    print_success "PostgreSQL is running"
else
    print_warning "PostgreSQL is not running"
    echo "  Start it: sudo systemctl start postgresql"
fi

# Redis
if systemctl is-active --quiet redis; then
    print_success "Redis is running"
else
    print_warning "Redis is not running"
    echo "  Start it: sudo systemctl start redis"
fi

print_step "Checking Database"

if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw rowly_production; then
    print_success "Database 'rowly_production' exists"
else
    print_warning "Database 'rowly_production' not found"
    echo ""
    echo "Create it with these commands:"
    echo "  sudo -u postgres psql << 'EOF'"
    echo "  CREATE DATABASE rowly_production;"
    echo "  CREATE USER rowly_user WITH ENCRYPTED PASSWORD 'YOUR_PASSWORD';"
    echo "  GRANT ALL PRIVILEGES ON DATABASE rowly_production TO rowly_user;"
    echo "  ALTER DATABASE rowly_production OWNER TO rowly_user;"
    echo "  \c rowly_production"
    echo "  CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
    echo "  EOF"
fi

print_step "Quick Secret Generation"
echo ""
echo "Generate secure secrets for your .env file:"
echo ""
echo "JWT_SECRET:"
openssl rand -base64 32
echo ""
echo "SESSION_SECRET:"
openssl rand -base64 32
echo ""
echo "REDIS_PASSWORD:"
openssl rand -base64 24
echo ""
echo "DB_PASSWORD (suggestion):"
openssl rand -base64 24
echo ""

print_step "Next Steps"
echo ""
echo "1. Finish SSL setup (if in progress):"
echo "   - Select option 1 to keep existing certificate"
echo ""
echo "2. Configure environment files:"
echo "   nano $APP_DIR/backend/.env"
echo "   nano $APP_DIR/frontend/.env.production"
echo ""
echo "3. Set up database (if not done):"
echo "   - Create database user and schema"
echo "   - Use the commands shown above"
echo ""
echo "4. Run deployment:"
echo "   sudo bash $APP_DIR/deployment/scripts/deploy-production.sh initial"
echo ""
echo "5. Or for updates only:"
echo "   sudo bash $APP_DIR/deployment/scripts/deploy-production.sh update"
echo ""

print_step "Useful Commands"
echo ""
echo "Generate secrets:          openssl rand -base64 32"
echo "Edit backend config:       nano $APP_DIR/backend/.env"
echo "Edit frontend config:      nano $APP_DIR/frontend/.env.production"
echo "Check PM2 status:          pm2 status"
echo "View logs:                 pm2 logs"
echo "Test health:               curl http://localhost:5000/health"
echo ""
