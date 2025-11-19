#!/bin/bash
# Rowly Production Deployment Script
# Run this script on your production server

set -e

echo "🚀 Rowly Production Deployment"
echo "================================"

# Configuration
PROJECT_DIR="/home/user/rowlyknit"
NGINX_ROOT="/var/www/rowlyknit"
BACKEND_DIR="$PROJECT_DIR/backend"

# Pull latest code
echo "📥 Pulling latest code..."
cd "$PROJECT_DIR"
git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy

# Build Frontend
echo "🎨 Building frontend..."
cd frontend
npm install
npm run build

# Deploy Frontend to Nginx
echo "📦 Deploying frontend to Nginx..."
sudo mkdir -p "$NGINX_ROOT"
sudo cp -r dist/* "$NGINX_ROOT/"
sudo chown -R www-data:www-data "$NGINX_ROOT"
sudo chmod -R 755 "$NGINX_ROOT"

# Build Backend (if needed)
echo "🔧 Building backend..."
cd "$BACKEND_DIR"
npm install --only=production
npm run build

# Run Database Migrations
echo "🗄️  Running database migrations..."
npm run migrate

# Restart Backend (PM2)
echo "♻️  Restarting backend service..."
if command -v pm2 &> /dev/null; then
    pm2 restart rowly-backend || pm2 start ecosystem.config.js
    pm2 save
else
    echo "⚠️  PM2 not found. Please install PM2 or use another process manager."
fi

# Restart Nginx
echo "🌐 Restarting Nginx..."
if command -v systemctl &> /dev/null; then
    sudo systemctl restart nginx
elif command -v service &> /dev/null; then
    sudo service nginx restart
else
    echo "⚠️  Please restart Nginx manually"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔍 Next steps:"
echo "  1. Check backend: pm2 status"
echo "  2. View logs: pm2 logs rowly-backend"
echo "  3. Test frontend: curl https://rowlyknit.com"
echo "  4. Test API: curl https://api.rowlyknit.com/health"
