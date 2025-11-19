# Rowly Docker Production Deployment Guide

## Quick Start (Your Current Setup)

Your production server is already set up with Docker. Follow these steps to complete the deployment:

---

## ✅ Current Status

Based on your terminal output:
- ✅ SSL certificates configured (valid until Feb 2026)
- ✅ Git repository cloned at `/home/user/rowlyknit`
- ✅ Correct branch: `claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy`
- ✅ Docker containers running (postgres, redis, backend, frontend, nginx)
- ✅ Backend `.env` configured with secrets

---

## 🚀 Complete Deployment Steps

### 1. Pull Latest Code

```bash
cd /home/user/rowlyknit
git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
```

### 2. Verify Environment Files

#### Backend Environment

```bash
cd /home/user/rowlyknit/backend

# Check if .env exists
if [ -f .env ]; then
    echo "✓ Backend .env exists"
    # Check for any remaining placeholders
    if grep -q "CHANGE" .env; then
        echo "⚠ Warning: Found CHANGE_ME placeholders in .env"
        echo "Please update: nano .env"
    else
        echo "✓ Backend .env looks configured"
    fi
else
    echo "Creating .env from example..."
    cp .env.production.example .env
    echo "Please configure: nano .env"
fi
```

**Key settings to verify in backend/.env:**
- `EMAIL_API_KEY=` (update if you want email functionality)
- All other secrets are already configured with secure random values

#### Frontend Environment

```bash
cd /home/user/rowlyknit/frontend

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "Creating .env.production from example..."
    cp .env.production.example .env.production
fi

# View settings
cat .env.production
```

The frontend .env.production should have:
```bash
VITE_API_URL=https://rowlyknit.com
VITE_WS_URL=wss://rowlyknit.com
VITE_APP_NAME=Rowly
VITE_APP_URL=https://rowlyknit.com
VITE_ENABLE_PWA=true
VITE_ENABLE_OFFLINE_MODE=true
```

### 3. Rebuild and Deploy with Docker

```bash
cd /home/user/rowlyknit

# Stop containers
docker compose down

# Pull latest images and rebuild
docker compose build --no-cache

# Start all services
docker compose up -d

# Check status
docker compose ps
```

### 4. Run Database Migrations

```bash
# Run migrations inside the backend container
docker compose exec backend npm run migrate

# Or if that doesn't work:
docker exec -it rowly_backend npm run migrate
```

### 5. Verify Deployment

```bash
# Check container health
docker compose ps

# Check backend health
curl http://localhost:5000/health

# Check frontend
curl http://localhost:3000

# Check logs if needed
docker compose logs backend
docker compose logs frontend
```

### 6. Test Public URLs

```bash
# Test HTTPS endpoints
curl https://rowlyknit.com
curl https://rowlyknit.com/health
curl https://api.rowlyknit.com/health

# Or open in browser:
# https://rowlyknit.com
```

---

## 🔧 Common Operations

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx

# Last 100 lines
docker compose logs --tail=100 backend
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart backend
docker compose restart frontend
```

### Update Application

```bash
cd /home/user/rowlyknit

# Pull latest code
git pull

# Rebuild and restart
docker compose down
docker compose build
docker compose up -d

# Run any new migrations
docker compose exec backend npm run migrate
```

### Database Operations

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U rowly_user -d rowly_production

# Backup database
docker compose exec postgres pg_dump -U rowly_user rowly_production | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore database
gunzip < backup_file.sql.gz | docker compose exec -T postgres psql -U rowly_user -d rowly_production
```

### Redis Operations

```bash
# Connect to Redis
docker compose exec redis redis-cli -a YOUR_REDIS_PASSWORD

# Check Redis info
docker compose exec redis redis-cli -a YOUR_REDIS_PASSWORD info

# Clear Redis cache
docker compose exec redis redis-cli -a YOUR_REDIS_PASSWORD FLUSHDB
```

---

## 🐛 Troubleshooting

### Containers Won't Start

```bash
# Check logs
docker compose logs

# Check disk space
df -h

# Check Docker status
systemctl status docker

# Restart Docker
systemctl restart docker
docker compose up -d
```

### Port Conflicts

```bash
# Check what's using ports
lsof -i :80
lsof -i :443
lsof -i :5000
lsof -i :3000

# Stop conflicting services
systemctl stop nginx  # if running outside Docker
```

### Database Connection Errors

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check database logs
docker compose logs postgres

# Verify environment variables
docker compose exec backend printenv | grep DB_

# Test connection manually
docker compose exec backend node -e "const knex = require('knex')(require('./knexfile')); knex.raw('SELECT 1').then(() => console.log('Connected!')).catch(e => console.error(e)).finally(() => process.exit())"
```

### Build Errors

```bash
# Clean rebuild
docker compose down -v
docker system prune -a
docker compose build --no-cache
docker compose up -d
```

### Frontend Not Loading

```bash
# Check frontend container
docker compose logs frontend

# Rebuild frontend
docker compose up -d --build --force-recreate frontend

# Check nginx config
docker compose exec nginx nginx -t
docker compose restart nginx
```

---

## 📊 Monitoring

### Health Checks

```bash
# Check all container health
docker compose ps

# Manual health check
curl http://localhost:5000/health
curl http://localhost:3000

# Check resource usage
docker stats

# Check container details
docker compose top
```

### Log Monitoring

```bash
# Real-time logs
docker compose logs -f

# Search logs
docker compose logs backend | grep error
docker compose logs backend | grep -i warning

# Export logs
docker compose logs > logs_$(date +%Y%m%d_%H%M%S).txt
```

---

## 🔐 Security

### Update Secrets

If you need to update secrets:

```bash
# Edit environment file
nano /home/user/rowlyknit/backend/.env

# Restart backend to apply
docker compose restart backend
```

### SSL Certificate Renewal

Your SSL certificates are valid until February 2026. To renew:

```bash
cd /home/user/rowlyknit/deployment/scripts
sudo bash setup-ssl.sh
```

The renewal process is automated via cron and should happen automatically.

---

## 📦 Backup Strategy

### Automated Backups

```bash
# Set up automated backups
cd /home/user/rowlyknit/deployment/scripts
sudo bash setup-backups.sh
```

### Manual Backup

```bash
# Create backup directory
mkdir -p /backups

# Backup database
docker compose exec -T postgres pg_dump -U rowly_user rowly_production | gzip > /backups/rowly_$(date +%Y%m%d_%H%M%S).sql.gz

# Backup uploads
tar -czf /backups/uploads_$(date +%Y%m%d_%H%M%S).tar.gz /home/user/rowlyknit/backend/uploads/

# Backup environment files
tar -czf /backups/env_$(date +%Y%m%d_%H%M%S).tar.gz /home/user/rowlyknit/backend/.env /home/user/rowlyknit/frontend/.env.production
```

---

## 🚀 Performance Optimization

### Resource Limits

Edit `docker-compose.yml` to add resource limits:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          memory: 512M
```

### Enable Compression

Already configured in nginx, but verify:

```bash
docker compose exec nginx cat /etc/nginx/nginx.conf | grep gzip
```

### Database Optimization

```bash
# Connect to database
docker compose exec postgres psql -U rowly_user -d rowly_production

# Run VACUUM and ANALYZE
VACUUM ANALYZE;

# Check index usage
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public';
```

---

## 📝 Quick Reference

### Most Common Commands

```bash
# Deploy/Update
cd /home/user/rowlyknit && git pull && docker compose up -d --build

# View logs
docker compose logs -f backend

# Restart everything
docker compose restart

# Health check
curl https://rowlyknit.com/health

# Database backup
docker compose exec -T postgres pg_dump -U rowly_user rowly_production | gzip > backup.sql.gz

# Stop all
docker compose down

# Start all
docker compose up -d
```

### Container Names

- `rowly_postgres` - PostgreSQL database
- `rowly_redis` - Redis cache
- `rowly_backend` - Node.js API server
- `rowly_frontend` - React frontend (nginx)
- `rowly_nginx` - Main reverse proxy

### Important Paths

- Application: `/home/user/rowlyknit`
- Backend env: `/home/user/rowlyknit/backend/.env`
- Frontend env: `/home/user/rowlyknit/frontend/.env.production`
- Uploads: `/home/user/rowlyknit/backend/uploads`
- Backups: `/backups`
- SSL certs: `/etc/letsencrypt/live/rowlyknit.com/`

---

## 🆘 Getting Help

If you encounter issues:

1. **Check logs**: `docker compose logs -f`
2. **Check container status**: `docker compose ps`
3. **Verify environment**: `cat backend/.env | grep -v PASSWORD`
4. **Test connectivity**: `curl http://localhost:5000/health`
5. **Review nginx logs**: `docker compose logs nginx`

For specific errors, check the troubleshooting section above or consult the application logs.
