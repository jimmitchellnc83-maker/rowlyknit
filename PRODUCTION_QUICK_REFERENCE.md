# Rowly Production - Quick Reference Card

## 🚨 IMPORTANT: Always run commands from /home/user/rowlyknit

```bash
cd /home/user/rowlyknit
```

## 🚀 Quick Deploy

```bash
cd /home/user/rowlyknit
bash scripts/deployment/DEPLOY_TO_PRODUCTION_NOW.sh
```

## 📊 Check Status

```bash
cd /home/user/rowlyknit
docker compose ps
```

## 📋 View Logs

```bash
cd /home/user/rowlyknit

# All logs
docker compose logs -f

# Specific service
docker compose logs backend --tail=50
docker compose logs frontend --tail=50
docker compose logs nginx --tail=50
```

## 🔄 Restart Services

```bash
cd /home/user/rowlyknit

# Restart all
docker compose restart

# Restart specific service
docker compose restart backend
docker compose restart frontend
docker compose restart nginx
```

## 🏥 Health Checks

```bash
# Backend
curl http://localhost:5000/health

# Frontend
curl http://localhost:3000

# Public site
curl https://rowlyknit.com

# Public API
curl https://api.rowlyknit.com/health
```

## 🛑 Stop/Start

```bash
cd /home/user/rowlyknit

# Stop all
docker compose down

# Start all
docker compose up -d
```

## 🔧 Rebuild & Redeploy

```bash
cd /home/user/rowlyknit
docker compose down
docker compose build --no-cache
docker compose up -d
docker compose exec -T backend npm run migrate
```

## 🗄️ Database Access

```bash
cd /home/user/rowlyknit
docker compose exec postgres psql -U rowly_user -d rowly_production
```

## 💾 Backup Database

```bash
cd /home/user/rowlyknit
docker compose exec postgres pg_dump -U rowly_user rowly_production > backup_$(date +%Y%m%d).sql
```

## 📈 System Resources

```bash
# Disk space
df -h

# Memory
free -h

# Docker usage
docker system df

# Container stats
docker stats
```

## 🐛 Diagnostics

```bash
cd /home/user/rowlyknit

# Full diagnostics
bash scripts/deployment/diagnose-production.sh

# Detailed status
bash deployment/scripts/status.sh
```

## 🔐 Environment Files

```bash
# Root .env (database passwords)
/home/user/rowlyknit/.env

# Backend .env (JWT secrets, API keys)
/home/user/rowlyknit/backend/.env

# Check backend .env
cat /home/user/rowlyknit/backend/.env
```

## 🔒 SSL Certificates

```bash
# Check SSL certs
ls -la /home/user/rowlyknit/deployment/ssl/

# Or Let's Encrypt location
ls -la /etc/letsencrypt/live/rowlyknit.com/
```

## 🐚 Shell Access

```bash
cd /home/user/rowlyknit

# Backend shell
docker compose exec backend sh

# Database shell
docker compose exec postgres psql -U rowly_user -d rowly_production

# Redis shell
docker compose exec redis redis-cli
```

## 📦 Update Application

```bash
cd /home/user/rowlyknit

# Pull latest code
git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy

# Rebuild and restart
docker compose build --no-cache
docker compose up -d --force-recreate

# Run migrations
docker compose exec -T backend npm run migrate
```

## 🧹 Cleanup

```bash
# Remove unused Docker images
docker image prune -a

# Show volumes (BE CAREFUL!)
docker volume ls

# Clean system (removes stopped containers, unused networks, dangling images)
docker system prune
```

## 📊 Monitoring Commands

```bash
cd /home/user/rowlyknit

# Watch container status
watch docker compose ps

# Follow all logs
docker compose logs -f

# Backend logs only
docker compose logs -f backend

# Error logs
docker compose logs | grep -i error
```

## 🚨 Emergency Commands

```bash
cd /home/user/rowlyknit

# Force restart everything
docker compose down && docker compose up -d

# Rebuild everything from scratch
docker compose down -v  # WARNING: This removes volumes!
docker compose build --no-cache
docker compose up -d

# View resource usage
docker stats

# Kill a specific container
docker kill rowly_backend
docker compose up -d backend
```

## 📞 Common Issues

### Backend won't start
```bash
cd /home/user/rowlyknit
docker compose logs backend --tail=100
docker compose restart backend
```

### Database connection errors
```bash
cd /home/user/rowlyknit
docker compose exec postgres pg_isready -U rowly_user
docker compose restart postgres
docker compose restart backend
```

### Nginx errors
```bash
cd /home/user/rowlyknit
docker compose logs nginx --tail=50
docker compose restart nginx
```

### Out of disk space
```bash
docker system prune -a
docker volume prune  # Careful with this!
df -h
```

## 📱 Application URLs

- **Frontend**: https://rowlyknit.com
- **API**: https://api.rowlyknit.com
- **Backend Health**: http://localhost:5000/health
- **Frontend Local**: http://localhost:3000

## 🔢 Port Reference

- `80/443` - Nginx (public)
- `127.0.0.1:3000` - Frontend
- `127.0.0.1:5000` - Backend
- `127.0.0.1:5432` - PostgreSQL
- `127.0.0.1:6379` - Redis
- `127.0.0.1:9090` - Prometheus metrics

---

**Remember**: Always `cd /home/user/rowlyknit` before running docker compose commands!
