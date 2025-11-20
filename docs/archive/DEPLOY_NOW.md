# 🚀 Deploy Rowly Production App - Quick Start

## Your Current Status

Based on your production server output, you already have:
- ✅ SSL certificates configured (valid until Feb 2026)
- ✅ Code checked out on the right branch
- ✅ Docker containers have been running
- ✅ Backend environment configured with secrets

## Complete Deployment in 3 Steps

### Step 1: Update Your Code

```bash
cd /home/user/rowlyknit
git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
```

### Step 2: Check Status

```bash
bash deployment/scripts/status.sh
```

This will show you exactly what needs to be configured.

### Step 3: Deploy!

```bash
bash deployment/scripts/docker-deploy.sh
```

This script will:
- ✅ Pull latest code
- ✅ Check environment files
- ✅ Build Docker containers
- ✅ Run database migrations
- ✅ Start all services
- ✅ Run health checks

## That's It!

Your app will be live at:
- **https://rowlyknit.com**
- **https://api.rowlyknit.com**

---

## Quick Reference

### Common Commands

```bash
# Check everything is working
bash deployment/scripts/status.sh

# View logs
docker compose logs -f

# Restart services
docker compose restart

# Update and redeploy
git pull && bash deployment/scripts/docker-deploy.sh
```

### Environment Files

Your backend `.env` is already configured with proper secrets. Only update if needed:

```bash
nano backend/.env
```

If you want to use email features, update:
- `EMAIL_API_KEY` or `SENDGRID_API_KEY`

The frontend `.env.production` has been created with correct defaults for your domain.

### Container Management

```bash
# See all containers
docker compose ps

# Restart a specific service
docker compose restart backend
docker compose restart frontend

# View logs for a service
docker compose logs -f backend

# Stop everything
docker compose down

# Start everything
docker compose up -d
```

### Database Operations

```bash
# Connect to database
docker compose exec postgres psql -U rowly_user -d rowly_production

# Run migrations
docker compose exec backend npm run migrate

# Backup database
docker compose exec -T postgres pg_dump -U rowly_user rowly_production | gzip > backup_$(date +%Y%m%d).sql.gz
```

---

## Need More Details?

See the comprehensive guides:
- **[DOCKER_PRODUCTION_GUIDE.md](DOCKER_PRODUCTION_GUIDE.md)** - Complete Docker deployment guide
- **[PRODUCTION_SETUP.md](PRODUCTION_SETUP.md)** - General production setup guide

---

## Troubleshooting

### Containers won't start?

```bash
# Check what's wrong
docker compose ps
docker compose logs

# Rebuild from scratch
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Backend not responding?

```bash
# Check backend logs
docker compose logs backend

# Check environment
docker compose exec backend printenv | grep -E '(DB_|REDIS_)'

# Restart backend
docker compose restart backend
```

### Database connection issues?

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check database logs
docker compose logs postgres

# Test connection
docker compose exec postgres pg_isready -U rowly_user
```

---

## 🎉 You're Ready!

Run the deployment script and your app will be live:

```bash
cd /home/user/rowlyknit
bash deployment/scripts/docker-deploy.sh
```

The script is interactive and will guide you through any remaining configuration steps.
