# Rowly Production Deployment Status

## Current Situation

Based on your terminal output from the production server:

```bash
root@rowlyknit-production:~# docker-compose ps
no configuration file provided: not found

root@rowlyknit-production:~# curl -I https://rowlyknit.com
HTTP/2 200
server: nginx/1.29.3
```

### What's Working
- ✅ Nginx is installed and running
- ✅ HTTPS is configured with SSL certificates
- ✅ Domain is responding (HTTP 200)
- ✅ Security headers are properly configured

### What Needs Attention
- ❌ Docker is not installed or not in PATH
- ❌ Docker Compose services are not running
- ❌ Commands being run from `/root` instead of `/home/user/rowlyknit`

## Production Server Setup Required

### Step 1: Install Docker (if not installed)

On your production server, run:

```bash
# Update package list
apt-get update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Start Docker
systemctl start docker
systemctl enable docker

# Verify installation
docker --version
docker compose version
```

### Step 2: Navigate to the Application Directory

All docker-compose commands must be run from the application directory:

```bash
cd /home/user/rowlyknit
```

### Step 3: Verify Environment Files

Ensure you have the required environment files:

```bash
# Check if backend .env exists
ls -la /home/user/rowlyknit/backend/.env

# Check if SSL certificates exist
ls -la /home/user/rowlyknit/deployment/ssl/

# Check root .env for database passwords
cat /home/user/rowlyknit/.env
```

### Step 4: Deploy the Application

From `/home/user/rowlyknit`, run the deployment script:

```bash
cd /home/user/rowlyknit
bash scripts/deployment/DEPLOY_TO_PRODUCTION_NOW.sh
```

Or manually:

```bash
cd /home/user/rowlyknit

# Pull latest code (if deploying from git)
git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy

# Build and start containers
docker compose build --no-cache
docker compose up -d

# Wait for services to start
sleep 10

# Run database migrations
docker compose exec -T backend npm run migrate

# Check status
docker compose ps
```

### Step 5: Verify Deployment

```bash
# From /home/user/rowlyknit directory

# Check all containers are running
docker compose ps

# Check backend health
curl http://localhost:5000/health

# Check frontend
curl http://localhost:3000

# Check public HTTPS endpoint
curl https://rowlyknit.com

# View logs
docker compose logs -f
```

## Common Commands (run from /home/user/rowlyknit)

### View Status
```bash
cd /home/user/rowlyknit
docker compose ps
```

### View Logs
```bash
cd /home/user/rowlyknit
docker compose logs -f
docker compose logs backend --tail=50
docker compose logs frontend --tail=50
docker compose logs nginx --tail=50
```

### Restart Services
```bash
cd /home/user/rowlyknit
docker compose restart backend
docker compose restart frontend
docker compose restart nginx
```

### Stop All Services
```bash
cd /home/user/rowlyknit
docker compose down
```

### Start All Services
```bash
cd /home/user/rowlyknit
docker compose up -d
```

### Rebuild and Redeploy
```bash
cd /home/user/rowlyknit
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Database Access
```bash
cd /home/user/rowlyknit
docker compose exec postgres psql -U rowly_user -d rowly_production
```

### Backend Shell
```bash
cd /home/user/rowlyknit
docker compose exec backend sh
```

## Architecture Overview

```
Internet
   ↓
Nginx (Port 80/443) - SSL Termination
   ↓
Frontend Container (Port 3000) - React App
   ↓
Backend Container (Port 5000) - Express API
   ↓
PostgreSQL Container (Port 5432) - Database
Redis Container (Port 6379) - Cache & Rate Limiting
```

## Port Mapping

All ports are bound to localhost only for security:

- `127.0.0.1:5000` → Backend API
- `127.0.0.1:3000` → Frontend
- `127.0.0.1:5432` → PostgreSQL
- `127.0.0.1:6379` → Redis
- `0.0.0.0:80` → Nginx HTTP (redirects to HTTPS)
- `0.0.0.0:443` → Nginx HTTPS

## Environment Variables

### Root .env
Located at `/home/user/rowlyknit/.env`:
- Database credentials
- Redis password
- Frontend API URL

### Backend .env
Located at `/home/user/rowlyknit/backend/.env`:
- JWT secrets
- Email configuration
- Third-party API keys
- All database/Redis configs

## SSL Certificates

SSL certificates should be located at:
- `/home/user/rowlyknit/deployment/ssl/fullchain.pem`
- `/home/user/rowlyknit/deployment/ssl/privkey.pem`

Or symlinked from Let's Encrypt:
- `/etc/letsencrypt/live/rowlyknit.com/fullchain.pem`
- `/etc/letsencrypt/live/rowlyknit.com/privkey.pem`

## Troubleshooting

### Issue: "docker: command not found"
**Solution:** Install Docker (see Step 1 above)

### Issue: "no configuration file provided: not found"
**Solution:** Run commands from `/home/user/rowlyknit` directory

### Issue: Backend health check fails
```bash
cd /home/user/rowlyknit
docker compose logs backend --tail=50
docker compose restart backend
```

### Issue: Frontend not loading
```bash
cd /home/user/rowlyknit
docker compose logs frontend --tail=50
docker compose restart frontend
```

### Issue: Database connection errors
```bash
cd /home/user/rowlyknit
docker compose logs postgres --tail=50
docker compose restart postgres
docker compose exec postgres pg_isready -U rowly_user
```

### Issue: SSL/HTTPS not working
1. Verify certificates exist in `deployment/ssl/`
2. Restart nginx: `docker compose restart nginx`
3. Check nginx logs: `docker compose logs nginx`

## Monitoring

### Check System Resources
```bash
# Disk space
df -h

# Memory usage
free -h

# Docker resource usage
docker system df
```

### Check Application Health
```bash
# Backend health endpoint
curl http://localhost:5000/health

# Public HTTPS endpoint
curl https://rowlyknit.com/health

# API health
curl https://api.rowlyknit.com/health
```

## Backup and Maintenance

### Database Backup
```bash
cd /home/user/rowlyknit
docker compose exec postgres pg_dump -U rowly_user rowly_production > backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
cd /home/user/rowlyknit
docker compose exec -T postgres psql -U rowly_user rowly_production < backup_20251120.sql
```

### Clean Up Docker
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes (CAUTION: Don't remove database volumes!)
docker volume ls
docker volume prune
```

## Next Steps

1. **SSH to production server**: `ssh root@rowlyknit-production`
2. **Install Docker** if not already installed
3. **Navigate to app directory**: `cd /home/user/rowlyknit`
4. **Run deployment script**: `bash scripts/deployment/DEPLOY_TO_PRODUCTION_NOW.sh`
5. **Verify deployment**: `docker compose ps` and `curl https://rowlyknit.com`

## Support

For detailed deployment documentation:
- See `docs/deployment/DEPLOYMENT_GUIDE.md`
- See `docs/deployment/TROUBLESHOOTING.md`

For quick status check:
```bash
cd /home/user/rowlyknit
bash deployment/scripts/status.sh
```

For diagnostics:
```bash
cd /home/user/rowlyknit
bash scripts/deployment/diagnose-production.sh
```
