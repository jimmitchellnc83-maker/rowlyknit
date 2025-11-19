#!/bin/bash
# Complete Docker cleanup and rebuild script

set -e

echo "==> Stopping all containers..."
docker-compose down || true

echo "==> Removing rowly containers..."
docker rm -f rowly_backend rowly_frontend rowly_nginx rowly_postgres rowly_redis 2>/dev/null || true

echo "==> Removing rowly images..."
docker rmi -f $(docker images | grep rowly | awk '{print $3}') 2>/dev/null || true

echo "==> Removing all build cache..."
docker builder prune -af || true

echo "==> Removing all system cache..."
docker system prune -af || true

echo "==> Updating file timestamps..."
touch backend/Dockerfile frontend/Dockerfile

echo "==> Rebuilding containers with --pull and --no-cache..."
docker-compose build --pull --no-cache

echo "==> Starting containers..."
docker-compose up -d

echo "==> Done! Checking container status..."
docker-compose ps
