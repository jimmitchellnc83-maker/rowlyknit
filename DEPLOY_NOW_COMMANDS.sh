#!/bin/bash
# Commands to run on your production server
# Execute these on rowlyknit.com after SSHing in

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Rowly Production Deployment${NC}"
echo "================================"
echo ""
echo "Run these commands on your server (ssh user@rowlyknit.com):"
echo ""

# Change to project directory
echo -e "${YELLOW}Step 1: Navigate to project directory${NC}"
echo "cd /home/user/rowlyknit"
echo ""

# Pull latest code
echo -e "${YELLOW}Step 2: Pull latest code from GitHub${NC}"
echo "git fetch origin"
echo "git checkout claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy"
echo "git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy"
echo ""

# Check if .env exists
echo -e "${YELLOW}Step 3: Check environment file${NC}"
echo "ls -la backend/.env"
echo ""
echo "If .env doesn't exist, you'll need to create it."
echo "I'll provide the content in the next step."
echo ""

# Deploy
echo -e "${YELLOW}Step 4: Run deployment${NC}"
echo "chmod +x DEPLOY_TO_PRODUCTION_NOW.sh"
echo "./DEPLOY_TO_PRODUCTION_NOW.sh"
echo ""

echo -e "${GREEN}That's it! The script will handle everything else.${NC}"
