#!/bin/bash
# Run this script on YOUR LOCAL MACHINE to deploy to production
# It will copy files and execute deployment on the server

set -e

SERVER="rowly@165.227.97.4"
SERVER_PATH="/home/rowly/rowlyknit"

echo "🚀 Deploying Rowly to Production"
echo "================================"
echo ""

# Step 1: Copy environment file
echo "📤 Step 1: Copying environment file to server..."
scp .env.production ${SERVER}:${SERVER_PATH}/backend/.env
echo "✅ Environment file copied"
echo ""

# Step 2: Copy deployment script
echo "📤 Step 2: Copying deployment script..."
scp DEPLOY_TO_PRODUCTION_NOW.sh ${SERVER}:${SERVER_PATH}/
echo "✅ Deployment script copied"
echo ""

# Step 3: SSH and deploy
echo "🚀 Step 3: Connecting to server and deploying..."
ssh ${SERVER} "cd ${SERVER_PATH} && bash -s" << 'ENDSSH'

echo "📥 Pulling latest code..."
git fetch origin
git checkout claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy

echo "🔧 Setting permissions..."
chmod +x DEPLOY_TO_PRODUCTION_NOW.sh

echo "🚀 Running deployment..."
./DEPLOY_TO_PRODUCTION_NOW.sh

ENDSSH

echo ""
echo "🎉 Deployment Complete!"
echo ""
echo "Your app should be live at:"
echo "  🌐 https://rowlyknit.com"
echo "  🔌 https://api.rowlyknit.com"
echo ""
