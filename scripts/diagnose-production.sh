#!/bin/bash

# Rowly Production Diagnostics Script
# This script helps diagnose issues with the production deployment

echo "🔍 Rowly Production Diagnostics"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check Docker
echo -e "${BLUE}1. Checking Docker...${NC}"
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅ Docker is installed${NC}"
    docker --version
else
    echo -e "${RED}❌ Docker is not installed${NC}"
fi
echo ""

# Check Docker Compose
echo -e "${BLUE}2. Checking Docker Compose...${NC}"
if command -v docker compose &> /dev/null; then
    echo -e "${GREEN}✅ Docker Compose is installed${NC}"
    docker compose version
else
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
fi
echo ""

# Check running containers
echo -e "${BLUE}3. Checking running containers...${NC}"
docker compose ps
echo ""

# Check backend health
echo -e "${BLUE}4. Testing backend health endpoint...${NC}"
if curl -f -s http://localhost:5000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is responding${NC}"
    curl -s http://localhost:5000/health | jq . || curl -s http://localhost:5000/health
else
    echo -e "${RED}❌ Backend is not responding on http://localhost:5000/health${NC}"
fi
echo ""

# Check backend logs
echo -e "${BLUE}5. Recent backend logs (last 20 lines):${NC}"
docker compose logs --tail=20 backend
echo ""

# Check nginx logs
echo -e "${BLUE}6. Recent nginx error logs (last 10 lines):${NC}"
docker compose logs --tail=10 nginx | grep -i error || echo "No errors found"
echo ""

# Check environment variables
echo -e "${BLUE}7. Checking environment variables in backend container...${NC}"
if docker compose exec -T backend sh -c 'echo "NODE_ENV=$NODE_ENV"' 2>/dev/null; then
    docker compose exec -T backend sh -c 'echo "PORT=$PORT"'
    docker compose exec -T backend sh -c 'echo "ALLOWED_ORIGINS=$ALLOWED_ORIGINS"'
    docker compose exec -T backend sh -c 'echo "DB_HOST=$DB_HOST"'
    docker compose exec -T backend sh -c 'echo "REDIS_HOST=$REDIS_HOST"'
else
    echo -e "${RED}❌ Cannot connect to backend container${NC}"
fi
echo ""

# Check database connection
echo -e "${BLUE}8. Checking database connection...${NC}"
if docker compose exec -T postgres pg_isready -U rowly_user 2>/dev/null; then
    echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
else
    echo -e "${RED}❌ PostgreSQL is not ready${NC}"
fi
echo ""

# Check Redis connection
echo -e "${BLUE}9. Checking Redis connection...${NC}"
if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
    echo -e "${GREEN}✅ Redis is responding${NC}"
else
    echo -e "${RED}❌ Redis is not responding${NC}"
fi
echo ""

# Check SSL certificates
echo -e "${BLUE}10. Checking SSL certificates...${NC}"
if [ -f "deployment/ssl/fullchain.pem" ]; then
    echo -e "${GREEN}✅ SSL certificate exists${NC}"
    openssl x509 -in deployment/ssl/fullchain.pem -noout -dates 2>/dev/null || echo "Cannot read certificate details"
else
    echo -e "${RED}❌ SSL certificate not found at deployment/ssl/fullchain.pem${NC}"
fi
echo ""

# Check ports
echo -e "${BLUE}11. Checking port availability...${NC}"
netstat -tlnp 2>/dev/null | grep -E ':(80|443|5000|5432|6379)' || \
    ss -tlnp 2>/dev/null | grep -E ':(80|443|5000|5432|6379)' || \
    echo "netstat/ss not available"
echo ""

# Summary
echo ""
echo -e "${YELLOW}================================${NC}"
echo -e "${YELLOW}Diagnostics Complete${NC}"
echo -e "${YELLOW}================================${NC}"
echo ""
echo "Common issues and solutions:"
echo ""
echo "1. Backend not responding:"
echo "   - Run: docker compose restart backend"
echo "   - Check logs: docker compose logs -f backend"
echo ""
echo "2. Database connection issues:"
echo "   - Run: docker compose restart postgres"
echo "   - Check logs: docker compose logs -f postgres"
echo ""
echo "3. SSL/HTTPS issues:"
echo "   - Ensure SSL certificates are in deployment/ssl/"
echo "   - Restart nginx: docker compose restart nginx"
echo ""
echo "4. Full rebuild needed:"
echo "   - Run: ./scripts/deploy-production.sh"
echo ""
