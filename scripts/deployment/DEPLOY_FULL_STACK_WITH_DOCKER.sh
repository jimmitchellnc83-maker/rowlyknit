#!/bin/bash
# Rowly Production Deployment Script with Docker Installation
# This script will install Docker if needed and deploy the full production stack
# Run this on your production server at /home/user/rowlyknit

set -e  # Exit on error

echo "🚀 Rowly Full Stack Production Deployment"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running on production server
if [ ! -d "/home/user/rowlyknit" ]; then
    echo -e "${RED}❌ Error: This script must be run on the production server${NC}"
    echo "Expected directory: /home/user/rowlyknit"
    echo "Current directory: $(pwd)"
    exit 1
fi

cd /home/user/rowlyknit

echo -e "${BLUE}🔍 Step 1: Checking Docker installation...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker not found. Installing Docker...${NC}"

    # Install Docker
    echo "Downloading Docker installation script..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh

    echo "Installing Docker..."
    sh /tmp/get-docker.sh

    echo "Starting Docker service..."
    systemctl start docker || service docker start || true
    systemctl enable docker || true

    # Clean up
    rm -f /tmp/get-docker.sh

    echo -e "${GREEN}✅ Docker installed successfully${NC}"
    docker --version
else
    echo -e "${GREEN}✅ Docker is already installed${NC}"
    docker --version
fi

# Check if Docker Compose is available
if docker compose version &> /dev/null; then
    echo -e "${GREEN}✅ Docker Compose is available${NC}"
    docker compose version
elif command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✅ Docker Compose (standalone) is available${NC}"
    docker-compose --version
else
    echo -e "${RED}❌ Docker Compose not found${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}📥 Step 2: Pulling latest code...${NC}"
if [ -d ".git" ]; then
    git fetch origin
    git checkout claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
    git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
    echo -e "${GREEN}✅ Code updated${NC}"
else
    echo -e "${YELLOW}⚠️  Not a git repository, using existing code${NC}"
fi
echo ""

echo -e "${YELLOW}🔧 Step 3: Checking environment files...${NC}"

# Check root .env for Docker Compose
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating root .env for Docker Compose...${NC}"
    cat > .env << 'EOF'
# Database Configuration
DB_NAME=rowly_production
DB_USER=rowly_user
DB_PASSWORD=FMT7sYclnq2Zp+d4aEwn2SpXoywdzBI/fCA+Uei7arA=

# Redis Configuration
REDIS_PASSWORD=JLDsUXWXOypGKAXx+ZyUjKBuhmiB7tI3ra5U91dHRyc=

# Frontend Configuration
VITE_API_URL=https://rowlyknit.com
EOF
    echo -e "${GREEN}✅ Root .env created${NC}"
fi

# Check backend .env
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠️  backend/.env not found${NC}"
    if [ -f "backend/.env.production.example" ]; then
        cp backend/.env.production.example backend/.env
        echo -e "${GREEN}✅ Created backend/.env from example${NC}"
    else
        echo -e "${RED}❌ backend/.env.production.example not found${NC}"
        echo "Please create backend/.env manually"
        exit 1
    fi
else
    echo -e "${GREEN}✅ backend/.env exists${NC}"
fi

# Check frontend .env.production
if [ ! -f "frontend/.env.production" ]; then
    echo "Creating frontend/.env.production..."
    cat > frontend/.env.production << 'EOF'
VITE_API_URL=https://rowlyknit.com
VITE_APP_NAME=Rowly
VITE_APP_VERSION=1.0.0
VITE_ENABLE_PWA=true
VITE_ENABLE_ANALYTICS=false
EOF
    echo -e "${GREEN}✅ frontend/.env.production created${NC}"
else
    echo -e "${GREEN}✅ frontend/.env.production exists${NC}"
fi
echo ""

echo -e "${YELLOW}🛑 Step 4: Stopping any existing containers...${NC}"
docker compose down || true
echo -e "${GREEN}✅ Existing containers stopped${NC}"
echo ""

echo -e "${YELLOW}🐳 Step 5: Building Docker containers...${NC}"
echo "This may take several minutes..."
docker compose build --no-cache
echo -e "${GREEN}✅ Containers built${NC}"
echo ""

echo -e "${YELLOW}🚀 Step 6: Starting all services...${NC}"
docker compose up -d
echo -e "${GREEN}✅ Services started${NC}"
echo ""

echo -e "${YELLOW}⏳ Step 7: Waiting for services to be ready...${NC}"
echo "Waiting for database to be healthy..."
for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U rowly_user -d rowly_production &> /dev/null; then
        echo -e "${GREEN}✅ Database is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Database failed to become ready${NC}"
        echo "Check logs: docker compose logs postgres"
        exit 1
    fi
    echo -n "."
    sleep 2
done
echo ""

echo -e "${YELLOW}🗄️  Step 8: Running database migrations...${NC}"
if docker compose exec -T backend npm run migrate; then
    echo -e "${GREEN}✅ Migrations completed successfully${NC}"
else
    echo -e "${RED}❌ Migrations failed${NC}"
    echo "Check logs: docker compose logs backend"
    echo "You may need to run migrations manually:"
    echo "  docker compose exec backend npm run migrate"
fi
echo ""

echo -e "${YELLOW}🏥 Step 9: Running health checks...${NC}"
sleep 5

# Check backend
echo -n "Checking backend... "
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Healthy${NC}"
else
    echo -e "${RED}❌ Failed${NC}"
    echo "  Check logs: docker compose logs backend"
fi

# Check frontend
echo -n "Checking frontend... "
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Healthy${NC}"
else
    echo -e "${RED}❌ Failed${NC}"
    echo "  Check logs: docker compose logs frontend"
fi

# Check PostgreSQL
echo -n "Checking PostgreSQL... "
if docker compose exec -T postgres pg_isready -U rowly_user -d rowly_production > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Healthy${NC}"
else
    echo -e "${RED}❌ Failed${NC}"
    echo "  Check logs: docker compose logs postgres"
fi

# Check Redis
echo -n "Checking Redis... "
if docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD:-JLDsUXWXOypGKAXx+ZyUjKBuhmiB7tI3ra5U91dHRyc=}" ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Check pending${NC}"
fi
echo ""

echo "📊 Container Status:"
docker compose ps
echo ""

echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo "Your application is now running!"
echo ""
echo "📍 Service Endpoints:"
echo "  • Backend API:  http://localhost:5000"
echo "  • Frontend:     http://localhost:3000"
echo "  • PostgreSQL:   localhost:5432"
echo "  • Redis:        localhost:6379"
echo ""
echo "🌐 Public URLs (after nginx/SSL setup):"
echo "  • Website:      https://rowlyknit.com"
echo "  • API:          https://api.rowlyknit.com"
echo ""
echo "📚 Useful Commands:"
echo "  📊 View status:        docker compose ps"
echo "  📋 View all logs:      docker compose logs -f"
echo "  📋 View backend logs:  docker compose logs -f backend"
echo "  🔄 Restart service:    docker compose restart backend"
echo "  🛑 Stop all:           docker compose down"
echo "  🚀 Start all:          docker compose up -d"
echo "  🐚 Backend shell:      docker compose exec backend sh"
echo "  🗄️  Database shell:     docker compose exec postgres psql -U rowly_user -d rowly_production"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Test the backend API:"
echo "   curl http://localhost:5000/health"
echo ""
echo "2. Test the frontend:"
echo "   curl http://localhost:3000"
echo ""
echo "3. Check if nginx is configured for HTTPS:"
echo "   docker compose logs nginx"
echo ""
echo "4. If you encounter issues, check the logs:"
echo "   docker compose logs -f"
echo ""
echo "5. For database operations:"
echo "   docker compose exec postgres psql -U rowly_user -d rowly_production"
echo ""
