# Production Troubleshooting Guide

This guide helps diagnose and fix common production deployment issues for Rowly.

## Current Issue: Backend Not Responding (Timeouts)

### Symptoms
- Socket.IO connection errors: `WebSocket connection to 'wss://rowlyknit.com/socket.io/' failed`
- API timeout errors: `ERR_TIMED_OUT` on `/api/auth/login` and `/api/auth/logout`
- Frontend cannot connect to backend services

### Root Cause
The backend service is not responding on the production server. This can happen when:
1. Backend container failed to start
2. Backend crashed due to missing environment variables
3. Backend was never properly deployed
4. Database or Redis connection failed, preventing backend from starting

## Quick Fix

### Option 1: Using the Deployment Script (Recommended)

```bash
# SSH into your production server
ssh user@your-production-server

# Navigate to project directory
cd /path/to/rowlyknit

# Run the deployment script
./scripts/deploy-production.sh
```

This script will:
- Stop all services
- Remove old images
- Rebuild backend and frontend
- Start all services
- Verify backend health

### Option 2: Manual Deployment

```bash
# SSH into your production server
ssh user@your-production-server

# Navigate to project directory
cd /path/to/rowlyknit

# Pull latest changes
git pull origin main

# Stop services
docker compose down

# Rebuild services
docker compose build --no-cache backend frontend

# Start services
docker compose up -d

# Check status
docker compose ps

# View backend logs
docker compose logs -f backend
```

## Diagnostic Steps

### 1. Run Diagnostic Script

```bash
./scripts/diagnose-production.sh
```

This will check:
- Docker installation
- Container status
- Backend health
- Database connectivity
- Redis connectivity
- SSL certificates
- Port availability

### 2. Check Service Status

```bash
# Check which containers are running
docker compose ps

# Expected output: All services should be "Up" or "healthy"
# - postgres: Up (healthy)
# - redis: Up (healthy)
# - backend: Up (healthy)
# - frontend: Up
# - nginx: Up (healthy)
```

### 3. Check Backend Logs

```bash
# View backend logs
docker compose logs -f backend

# Look for errors like:
# - "Cannot connect to database"
# - "Redis connection failed"
# - "Missing environment variable"
# - Any JavaScript/TypeScript errors
```

### 4. Test Backend Health

```bash
# Test backend health endpoint
curl http://localhost:5000/health

# Expected response:
# {
#   "success": true,
#   "message": "Rowly API is running",
#   "timestamp": "...",
#   "environment": "production"
# }
```

### 5. Check Environment Variables

```bash
# Verify backend has correct environment variables
docker compose exec backend sh -c 'echo "NODE_ENV=$NODE_ENV"'
docker compose exec backend sh -c 'echo "ALLOWED_ORIGINS=$ALLOWED_ORIGINS"'
docker compose exec backend sh -c 'echo "DB_HOST=$DB_HOST"'

# Expected values:
# NODE_ENV=production
# ALLOWED_ORIGINS=https://rowlyknit.com,https://www.rowlyknit.com
# DB_HOST=postgres
```

## Common Issues and Solutions

### Issue 1: Backend Container Won't Start

**Symptoms:**
- `docker compose ps` shows backend as "Exit 1" or "Restarting"

**Solution:**
```bash
# Check logs for error
docker compose logs backend

# Common causes:
# 1. Missing .env file
#    - Copy backend/.env.example to backend/.env
#    - Fill in required values (DB_PASSWORD, JWT_SECRET, etc.)

# 2. Database connection failed
#    - Ensure postgres container is running
#    - Check DB_PASSWORD matches in both .env and docker-compose.yml

# 3. Redis connection failed
#    - Ensure redis container is running
#    - Check REDIS_PASSWORD matches in both .env and docker-compose.yml

# Restart backend after fixing
docker compose restart backend
```

### Issue 2: Database Connection Failed

**Symptoms:**
- Backend logs show: "Cannot connect to database" or "Connection refused"

**Solution:**
```bash
# Check if postgres is running
docker compose ps postgres

# Check postgres logs
docker compose logs postgres

# Restart postgres
docker compose restart postgres

# Wait for postgres to be healthy
docker compose ps

# Restart backend
docker compose restart backend
```

### Issue 3: Redis Connection Failed

**Symptoms:**
- Backend logs show: "Redis connection failed" or "ECONNREFUSED"

**Solution:**
```bash
# Check if redis is running
docker compose ps redis

# Restart redis
docker compose restart redis

# Restart backend
docker compose restart backend
```

### Issue 4: CORS / WebSocket Issues

**Symptoms:**
- "CORS policy" errors in browser console
- WebSocket connection fails

**Verification:**
```bash
# Check ALLOWED_ORIGINS is set correctly
docker compose exec backend sh -c 'echo "ALLOWED_ORIGINS=$ALLOWED_ORIGINS"'

# Should output:
# ALLOWED_ORIGINS=https://rowlyknit.com,https://www.rowlyknit.com
```

**Solution:**
The configuration is already correct in the codebase:
- `backend/.env` line 59: `ALLOWED_ORIGINS=https://rowlyknit.com,https://www.rowlyknit.com`
- Backend app.ts uses this for CORS
- Socket.IO uses this for WebSocket CORS

Just rebuild the backend:
```bash
docker compose build --no-cache backend
docker compose restart backend
```

### Issue 5: SSL Certificate Issues

**Symptoms:**
- Browser shows "Not Secure" or SSL warnings
- Cannot access site via HTTPS

**Solution:**
```bash
# Ensure SSL certificates exist
ls -la deployment/ssl/

# Should contain:
# - fullchain.pem
# - privkey.pem

# If missing, generate with Let's Encrypt:
# (adjust domain and email)
certbot certonly --webroot -w /var/www/certbot \
  -d rowlyknit.com -d www.rowlyknit.com \
  --email your-email@example.com \
  --agree-tos --non-interactive

# Copy certificates
cp /etc/letsencrypt/live/rowlyknit.com/fullchain.pem deployment/ssl/
cp /etc/letsencrypt/live/rowlyknit.com/privkey.pem deployment/ssl/

# Restart nginx
docker compose restart nginx
```

### Issue 6: Frontend Shows Old Version

**Symptoms:**
- Frontend doesn't reflect latest changes
- Old code is being served

**Solution:**
```bash
# Rebuild frontend with no cache
docker compose build --no-cache frontend

# Restart frontend and nginx
docker compose restart frontend nginx

# Clear browser cache and hard reload (Ctrl+Shift+R)
```

## Environment Variables Checklist

Ensure these variables are set in `backend/.env`:

```bash
# Required for backend startup
✓ NODE_ENV=production
✓ PORT=5000
✓ DB_HOST=postgres
✓ DB_PASSWORD=<your-db-password>
✓ REDIS_HOST=redis
✓ REDIS_PASSWORD=<your-redis-password>
✓ JWT_SECRET=<your-jwt-secret>
✓ JWT_REFRESH_SECRET=<your-refresh-secret>
✓ CSRF_SECRET=<your-csrf-secret>
✓ SESSION_SECRET=<your-session-secret>
✓ ALLOWED_ORIGINS=https://rowlyknit.com,https://www.rowlyknit.com
✓ CORS_ORIGIN=https://rowlyknit.com
```

Ensure this variable is set in root `.env`:

```bash
✓ VITE_API_URL=https://rowlyknit.com
```

## Monitoring

### View Real-time Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f nginx
docker compose logs -f postgres
```

### Check Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df
```

### Check Network Connectivity

```bash
# Test from within backend container
docker compose exec backend sh

# Inside container:
wget -O- http://localhost:5000/health
ping postgres
ping redis
exit
```

## Preventive Measures

### 1. Health Checks

Monitor these URLs:
- Backend: `https://rowlyknit.com/api/health`
- Frontend: `https://rowlyknit.com/health`

### 2. Automated Backups

The system is configured to backup daily. Verify:
```bash
# Check backup schedule
docker compose exec backend sh -c 'echo "BACKUP_ENABLED=$BACKUP_ENABLED"'
docker compose exec backend sh -c 'echo "BACKUP_SCHEDULE=$BACKUP_SCHEDULE"'

# Check backups exist
ls -la backups/
```

### 3. Log Rotation

Ensure Docker logs don't fill disk:
```bash
# Add to docker-compose.yml for each service:
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## Getting Help

If issues persist:

1. Collect diagnostics:
   ```bash
   ./scripts/diagnose-production.sh > diagnostics.txt
   docker compose logs > docker-logs.txt
   ```

2. Check the logs for specific error messages

3. Review the configuration files:
   - `docker-compose.yml`
   - `backend/.env`
   - `deployment/nginx/conf.d/rowlyknit.conf`

## Quick Reference Commands

```bash
# Restart everything
docker compose restart

# Rebuild and restart backend
docker compose build --no-cache backend && docker compose restart backend

# View backend logs
docker compose logs -f backend

# Check service status
docker compose ps

# Run diagnostics
./scripts/diagnose-production.sh

# Full redeploy
./scripts/deploy-production.sh
```
