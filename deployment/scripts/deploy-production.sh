#!/bin/bash

# ============================================
# Rowly Production Deployment Script for Digital Ocean
# ============================================
# This script handles the complete deployment process
# Usage: ./deploy-production.sh [initial|update]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/home/rowly/rowlyknit"
DEPLOY_USER="rowly"
BRANCH="claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy"
BACKUP_DIR="/backups"

# Deployment type
DEPLOY_TYPE=${1:-update}

# ============================================
# Helper Functions
# ============================================

print_header() {
    echo -e "\n${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "Please run as root or with sudo"
        exit 1
    fi
}

# Check environment files
check_env_files() {
    print_header "Checking Environment Configuration"

    if [ ! -f "$APP_DIR/backend/.env" ]; then
        print_error "Backend .env file not found!"
        print_info "Please copy backend/.env.production.example to backend/.env and configure it"
        exit 1
    fi

    if [ ! -f "$APP_DIR/frontend/.env.production" ]; then
        print_error "Frontend .env.production file not found!"
        print_info "Please copy frontend/.env.production.example to frontend/.env.production and configure it"
        exit 1
    fi

    print_success "Environment files found"
}

# Create backup before deployment
create_backup() {
    print_header "Creating Pre-Deployment Backup"

    if command -v pg_dump &> /dev/null; then
        BACKUP_FILE="$BACKUP_DIR/pre_deploy_$(date +%Y%m%d_%H%M%S).sql.gz"
        sudo -u postgres pg_dump rowly_production | gzip > $BACKUP_FILE
        print_success "Database backup created: $BACKUP_FILE"
    else
        print_warning "pg_dump not found, skipping database backup"
    fi
}

# ============================================
# Initial Deployment Functions
# ============================================

setup_system() {
    print_header "Setting Up System"

    # Update system
    print_info "Updating system packages..."
    apt update && apt upgrade -y

    # Install dependencies
    print_info "Installing dependencies..."
    apt install -y curl git build-essential nginx postgresql postgresql-contrib redis-server certbot python3-certbot-nginx

    # Install Node.js 18.x
    print_info "Installing Node.js..."
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt install -y nodejs
    fi

    print_success "System setup complete"
    node --version
    npm --version
}

setup_database() {
    print_header "Setting Up PostgreSQL Database"

    # Start PostgreSQL
    systemctl start postgresql
    systemctl enable postgresql

    # Create database and user
    print_info "Creating database and user..."
    sudo -u postgres psql << EOF
CREATE DATABASE rowly_production;
CREATE USER rowly_user WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON DATABASE rowly_production TO rowly_user;
ALTER DATABASE rowly_production OWNER TO rowly_user;
\c rowly_production
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOF

    print_success "Database setup complete"
}

setup_redis() {
    print_header "Setting Up Redis"

    # Start Redis
    systemctl start redis
    systemctl enable redis

    # Configure Redis
    print_info "Configuring Redis..."
    sed -i "s/# requirepass .*/requirepass ${REDIS_PASSWORD}/" /etc/redis/redis.conf
    sed -i "s/bind .*/bind 127.0.0.1/" /etc/redis/redis.conf

    systemctl restart redis

    print_success "Redis setup complete"
}

setup_user() {
    print_header "Setting Up Application User"

    if ! id -u $DEPLOY_USER &> /dev/null; then
        useradd -m -s /bin/bash $DEPLOY_USER
        print_success "User $DEPLOY_USER created"
    else
        print_info "User $DEPLOY_USER already exists"
    fi
}

clone_repository() {
    print_header "Cloning Repository"

    if [ ! -d "$APP_DIR" ]; then
        sudo -u $DEPLOY_USER git clone https://github.com/jimmitchellnc83-maker/rowlyknit.git $APP_DIR
        cd $APP_DIR
        sudo -u $DEPLOY_USER git checkout $BRANCH
        print_success "Repository cloned"
    else
        print_info "Repository already exists"
    fi
}

install_dependencies() {
    print_header "Installing Application Dependencies"

    # Backend dependencies
    print_info "Installing backend dependencies..."
    cd $APP_DIR/backend
    sudo -u $DEPLOY_USER npm ci --only=production

    # Frontend dependencies
    print_info "Installing frontend dependencies..."
    cd $APP_DIR/frontend
    sudo -u $DEPLOY_USER npm ci

    print_success "Dependencies installed"
}

build_application() {
    print_header "Building Application"

    # Build backend
    print_info "Building backend..."
    cd $APP_DIR/backend
    sudo -u $DEPLOY_USER npm run build

    # Build frontend
    print_info "Building frontend..."
    cd $APP_DIR/frontend
    sudo -u $DEPLOY_USER npm run build

    print_success "Application built"
}

run_migrations() {
    print_header "Running Database Migrations"

    cd $APP_DIR/backend
    sudo -u $DEPLOY_USER npm run migrate

    print_success "Migrations completed"
}

setup_pm2() {
    print_header "Setting Up PM2 Process Manager"

    # Install PM2 globally
    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2
    fi

    # Start application with PM2
    cd $APP_DIR
    sudo -u $DEPLOY_USER pm2 start ecosystem.config.js

    # Save PM2 process list
    sudo -u $DEPLOY_USER pm2 save

    # Setup PM2 startup script
    pm2 startup systemd -u $DEPLOY_USER --hp /home/$DEPLOY_USER

    print_success "PM2 setup complete"
}

setup_nginx() {
    print_header "Setting Up Nginx"

    # Copy nginx configuration
    cp $APP_DIR/deployment/nginx/conf.d/rowlyknit.conf /etc/nginx/sites-available/rowlyknit

    # Create symlink
    if [ ! -L "/etc/nginx/sites-enabled/rowlyknit" ]; then
        ln -s /etc/nginx/sites-available/rowlyknit /etc/nginx/sites-enabled/rowlyknit
    fi

    # Test nginx configuration
    nginx -t

    # Restart nginx
    systemctl restart nginx
    systemctl enable nginx

    print_success "Nginx configured"
}

setup_ssl() {
    print_header "Setting Up SSL/TLS Certificates"

    print_info "Obtaining Let's Encrypt certificates..."

    # Stop nginx temporarily
    systemctl stop nginx

    # Obtain certificates
    certbot certonly \
        --standalone \
        --preferred-challenges http \
        --email admin@rowlyknit.com \
        --agree-tos \
        --no-eff-email \
        -d rowlyknit.com \
        -d www.rowlyknit.com \
        -d api.rowlyknit.com

    # Start nginx
    systemctl start nginx

    # Setup auto-renewal
    echo "0 0 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'" | crontab -

    print_success "SSL certificates configured"
}

setup_firewall() {
    print_header "Setting Up Firewall"

    # Install UFW
    apt install -y ufw

    # Default policies
    ufw default deny incoming
    ufw default allow outgoing

    # Allow SSH
    ufw allow 22/tcp

    # Allow HTTP/HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp

    # Enable firewall
    ufw --force enable

    print_success "Firewall configured"
}

setup_monitoring() {
    print_header "Setting Up Monitoring"

    # Install PM2 log rotation
    sudo -u $DEPLOY_USER pm2 install pm2-logrotate

    # Configure log rotation
    sudo -u $DEPLOY_USER pm2 set pm2-logrotate:max_size 10M
    sudo -u $DEPLOY_USER pm2 set pm2-logrotate:retain 7
    sudo -u $DEPLOY_USER pm2 set pm2-logrotate:compress true

    print_success "Monitoring configured"
}

setup_backups() {
    print_header "Setting Up Automated Backups"

    # Run backup setup script
    bash $APP_DIR/deployment/scripts/setup-backups.sh

    print_success "Backup automation configured"
}

# ============================================
# Update Deployment Functions
# ============================================

update_code() {
    print_header "Updating Code"

    cd $APP_DIR
    sudo -u $DEPLOY_USER git fetch origin
    sudo -u $DEPLOY_USER git checkout $BRANCH
    sudo -u $DEPLOY_USER git pull origin $BRANCH

    print_success "Code updated"
}

update_dependencies() {
    print_header "Updating Dependencies"

    # Backend
    cd $APP_DIR/backend
    sudo -u $DEPLOY_USER npm ci --only=production

    # Frontend
    cd $APP_DIR/frontend
    sudo -u $DEPLOY_USER npm ci

    print_success "Dependencies updated"
}

restart_services() {
    print_header "Restarting Services"

    # Restart PM2 apps
    sudo -u $DEPLOY_USER pm2 restart all

    # Reload Nginx
    systemctl reload nginx

    print_success "Services restarted"
}

# ============================================
# Health Checks
# ============================================

health_check() {
    print_header "Running Health Checks"

    sleep 5

    # Check backend
    if curl -f http://localhost:5000/health > /dev/null 2>&1; then
        print_success "Backend is healthy"
    else
        print_error "Backend health check failed"
        sudo -u $DEPLOY_USER pm2 logs rowly-backend --lines 50
        exit 1
    fi

    # Check frontend
    if curl -f http://localhost > /dev/null 2>&1; then
        print_success "Frontend is accessible"
    else
        print_warning "Frontend accessibility check failed (may be normal if SSL not setup yet)"
    fi

    # Check PM2 status
    print_info "PM2 Status:"
    sudo -u $DEPLOY_USER pm2 status
}

# ============================================
# Main Deployment Flow
# ============================================

main() {
    print_header "Rowly Production Deployment"
    print_info "Deployment type: $DEPLOY_TYPE"

    check_root

    if [ "$DEPLOY_TYPE" = "initial" ]; then
        print_info "Running initial deployment..."

        setup_system
        setup_user
        clone_repository
        check_env_files
        setup_database
        setup_redis
        install_dependencies
        build_application
        run_migrations
        setup_pm2
        setup_nginx
        setup_firewall
        setup_monitoring
        setup_backups

        print_info "SSL setup requires manual configuration after DNS is pointing to this server"
        print_info "Run: bash $APP_DIR/deployment/scripts/setup-ssl.sh"

    elif [ "$DEPLOY_TYPE" = "update" ]; then
        print_info "Running update deployment..."

        check_env_files
        create_backup
        update_code
        update_dependencies
        build_application
        run_migrations
        restart_services

    else
        print_error "Invalid deployment type: $DEPLOY_TYPE"
        print_info "Usage: $0 [initial|update]"
        exit 1
    fi

    health_check

    print_header "Deployment Complete!"
    print_success "Application is running"
    print_info "Frontend: https://rowlyknit.com"
    print_info "API: https://api.rowlyknit.com"
    print_info "Health: https://api.rowlyknit.com/health"
    print_info ""
    print_info "Useful commands:"
    print_info "  View logs: sudo -u $DEPLOY_USER pm2 logs"
    print_info "  Restart: sudo -u $DEPLOY_USER pm2 restart all"
    print_info "  Status: sudo -u $DEPLOY_USER pm2 status"
    print_info "  Backup: sudo bash $APP_DIR/deployment/scripts/setup-backups.sh"
}

# Run main function
main
