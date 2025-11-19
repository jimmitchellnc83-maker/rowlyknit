#!/bin/bash

# ============================================
# Rowly Production Status Checker
# ============================================
# Quick status check for your production deployment

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/home/user/rowlyknit"

print_section() {
    echo -e "\n${BLUE}═══ $1 ═══${NC}"
}

print_ok() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_fail() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "  $1"
}

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Rowly Production Status Check       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"

# ============================================
# Git Status
# ============================================

print_section "Git Repository"

cd $APP_DIR

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ $? -eq 0 ]; then
    print_ok "Repository found"
    print_info "Branch: $BRANCH"

    # Check for uncommitted changes
    if git diff-index --quiet HEAD -- 2>/dev/null; then
        print_ok "Working tree clean"
    else
        print_warn "Uncommitted changes detected"
    fi

    # Check if behind origin
    git fetch origin $BRANCH 2>/dev/null
    LOCAL=$(git rev-parse @ 2>/dev/null)
    REMOTE=$(git rev-parse @{u} 2>/dev/null)

    if [ "$LOCAL" = "$REMOTE" ]; then
        print_ok "Up to date with origin"
    else
        print_warn "Local is behind origin - run: git pull"
    fi
else
    print_fail "Not a git repository"
fi

# ============================================
# Environment Files
# ============================================

print_section "Environment Configuration"

# Backend .env
if [ -f "$APP_DIR/backend/.env" ]; then
    print_ok "Backend .env exists"

    if grep -q "CHANGE" "$APP_DIR/backend/.env" 2>/dev/null; then
        print_warn "Contains CHANGE_ME placeholders"
    else
        print_ok "Backend .env configured"
    fi

    # Check critical variables
    if grep -q "^JWT_SECRET=" "$APP_DIR/backend/.env" && \
       grep -q "^DB_PASSWORD=" "$APP_DIR/backend/.env" && \
       grep -q "^REDIS_PASSWORD=" "$APP_DIR/backend/.env"; then
        print_ok "Critical secrets present"
    else
        print_warn "Some secrets may be missing"
    fi
else
    print_fail "Backend .env not found"
    print_info "Run: cp backend/.env.production.example backend/.env"
fi

# Frontend .env.production
if [ -f "$APP_DIR/frontend/.env.production" ]; then
    print_ok "Frontend .env.production exists"
else
    print_warn "Frontend .env.production not found"
    print_info "Run: cp frontend/.env.production.example frontend/.env.production"
fi

# ============================================
# Docker Status
# ============================================

print_section "Docker Containers"

if command -v docker &> /dev/null; then
    print_ok "Docker is installed"

    # Check if Docker daemon is running
    if docker info &> /dev/null; then
        print_ok "Docker daemon is running"

        # Check containers
        cd $APP_DIR
        if docker compose ps &> /dev/null 2>&1; then
            echo ""
            print_info "Container Status:"
            docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"
            echo ""

            # Check individual services
            CONTAINERS=("postgres" "redis" "backend" "frontend" "nginx")
            for container in "${CONTAINERS[@]}"; do
                if docker compose ps $container | grep -q "Up"; then
                    print_ok "$container is running"
                else
                    print_fail "$container is not running"
                fi
            done
        else
            print_warn "No docker-compose.yml found or no containers running"
        fi
    else
        print_fail "Docker daemon is not running"
        print_info "Start it: systemctl start docker"
    fi
else
    print_warn "Docker not found"
    print_info "This deployment uses Docker. Install it or use PM2 deployment."
fi

# ============================================
# Port Status
# ============================================

print_section "Ports & Services"

check_port() {
    if command -v netstat &> /dev/null; then
        netstat -tlnp 2>/dev/null | grep -q ":$1 " && return 0
    elif command -v ss &> /dev/null; then
        ss -tlnp 2>/dev/null | grep -q ":$1 " && return 0
    elif command -v lsof &> /dev/null; then
        lsof -i ":$1" -sTCP:LISTEN &> /dev/null && return 0
    fi
    return 1
}

if check_port 80; then
    print_ok "Port 80 (HTTP) is listening"
else
    print_warn "Port 80 (HTTP) is not listening"
fi

if check_port 443; then
    print_ok "Port 443 (HTTPS) is listening"
else
    print_warn "Port 443 (HTTPS) is not listening"
fi

if check_port 5000; then
    print_ok "Port 5000 (Backend) is listening"
else
    print_warn "Port 5000 (Backend) is not listening"
fi

if check_port 5432; then
    print_ok "Port 5432 (PostgreSQL) is listening"
else
    print_warn "Port 5432 (PostgreSQL) is not listening"
fi

if check_port 6379; then
    print_ok "Port 6379 (Redis) is listening"
else
    print_warn "Port 6379 (Redis) is not listening"
fi

# ============================================
# Health Checks
# ============================================

print_section "Application Health"

# Backend health
if command -v curl &> /dev/null; then
    if curl -f -s http://localhost:5000/health > /dev/null 2>&1; then
        print_ok "Backend health check passed"
        HEALTH_DATA=$(curl -s http://localhost:5000/health 2>/dev/null)
        if echo "$HEALTH_DATA" | grep -q "database"; then
            print_info "Database: $(echo "$HEALTH_DATA" | grep -o '"database":"[^"]*"' | cut -d'"' -f4)"
        fi
        if echo "$HEALTH_DATA" | grep -q "redis"; then
            print_info "Redis: $(echo "$HEALTH_DATA" | grep -o '"redis":"[^"]*"' | cut -d'"' -f4)"
        fi
    else
        print_fail "Backend health check failed"
        print_info "Check logs: docker compose logs backend"
    fi

    # Public HTTPS endpoints
    if curl -f -s -k https://localhost/health > /dev/null 2>&1; then
        print_ok "HTTPS health endpoint accessible"
    else
        print_warn "HTTPS health endpoint not accessible"
    fi
else
    print_warn "curl not installed, skipping health checks"
fi

# ============================================
# SSL Certificates
# ============================================

print_section "SSL/TLS Certificates"

if [ -d "/etc/letsencrypt/live/rowlyknit.com" ]; then
    print_ok "SSL certificates found"

    if command -v certbot &> /dev/null; then
        CERT_INFO=$(certbot certificates 2>/dev/null | grep -A 5 "rowlyknit.com")
        if echo "$CERT_INFO" | grep -q "VALID"; then
            EXPIRY=$(echo "$CERT_INFO" | grep "Expiry Date" | head -1)
            print_ok "Certificates are valid"
            print_info "$EXPIRY"
        else
            print_warn "Certificate status unclear"
        fi
    else
        print_info "Certificate directory exists"
    fi
else
    print_warn "No SSL certificates found at /etc/letsencrypt"
    print_info "Run: bash deployment/scripts/setup-ssl.sh"
fi

# ============================================
# Disk Space
# ============================================

print_section "System Resources"

if command -v df &> /dev/null; then
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -lt 80 ]; then
        print_ok "Disk usage: ${DISK_USAGE}%"
    elif [ "$DISK_USAGE" -lt 90 ]; then
        print_warn "Disk usage: ${DISK_USAGE}%"
    else
        print_fail "Disk usage critical: ${DISK_USAGE}%"
    fi
fi

# Memory usage
if command -v free &> /dev/null; then
    MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
    if [ "$MEM_USAGE" -lt 80 ]; then
        print_ok "Memory usage: ${MEM_USAGE}%"
    else
        print_warn "Memory usage: ${MEM_USAGE}%"
    fi
fi

# Docker disk usage
if command -v docker &> /dev/null && docker info &> /dev/null; then
    DOCKER_SIZE=$(docker system df --format "{{.Size}}" 2>/dev/null | head -1)
    if [ -n "$DOCKER_SIZE" ]; then
        print_info "Docker disk usage: $DOCKER_SIZE"
    fi
fi

# ============================================
# Recent Logs (Errors)
# ============================================

print_section "Recent Errors"

if docker compose logs --tail=100 2>/dev/null | grep -i error | head -5 | grep -q "error"; then
    print_warn "Recent errors found in logs:"
    docker compose logs --tail=100 2>/dev/null | grep -i error | head -3
    print_info "View full logs: docker compose logs -f"
else
    print_ok "No recent errors in logs"
fi

# ============================================
# Summary
# ============================================

print_section "Quick Commands"

echo ""
print_info "View logs:       cd $APP_DIR && docker compose logs -f"
print_info "Restart:         cd $APP_DIR && docker compose restart"
print_info "Update app:      cd $APP_DIR && bash deployment/scripts/docker-deploy.sh"
print_info "Shell access:    docker compose exec backend sh"
print_info "Database:        docker compose exec postgres psql -U rowly_user -d rowly_production"
print_info "Stop all:        cd $APP_DIR && docker compose down"
print_info "Start all:       cd $APP_DIR && docker compose up -d"
echo ""

echo -e "${BLUE}═══════════════════════════════════════${NC}\n"
