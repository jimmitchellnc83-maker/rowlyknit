#!/bin/bash

# Quick script to restart nginx container
# This applies the SSL certificate and configuration changes

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Restarting nginx container...${NC}"

cd /home/user/rowlyknit

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    exit 1
fi

# Restart nginx container
echo -e "${YELLOW}Restarting nginx...${NC}"
docker compose restart nginx

# Wait a few seconds
sleep 3

# Check nginx status
echo -e "${YELLOW}Checking nginx status...${NC}"
if docker compose ps nginx | grep -q "Up"; then
    echo -e "${GREEN}✓ Nginx is running successfully${NC}"

    # Show nginx logs to verify no errors
    echo -e "${YELLOW}Recent nginx logs:${NC}"
    docker compose logs --tail=20 nginx
else
    echo -e "${RED}✗ Nginx failed to start${NC}"
    echo -e "${YELLOW}Showing error logs:${NC}"
    docker compose logs --tail=50 nginx
    exit 1
fi

echo -e "${GREEN}✓ Nginx restart complete!${NC}"
echo -e "${BLUE}The application should now be accessible via HTTPS${NC}"
