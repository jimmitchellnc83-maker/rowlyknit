# Docker Deployment Guide for Rowly Production

This guide will help you deploy the Rowly application with Docker on your production server.

## Prerequisites

- Ubuntu/Debian-based Linux server
- Root or sudo access
- At least 2GB RAM
- At least 10GB free disk space

## Quick Start

### Option 1: Automated Full Stack Deployment (Recommended)

Run this single command to install Docker, build containers, and deploy everything:

```bash
cd /home/user/rowlyknit
bash scripts/deployment/DEPLOY_FULL_STACK_WITH_DOCKER.sh
```

This script will:
1. ✅ Check for Docker and install it if missing
2. ✅ Pull latest code from git
3. ✅ Set up environment files
4. ✅ Build all Docker containers
5. ✅ Start PostgreSQL, Redis, Backend, Frontend, and Nginx
6. ✅ Run database migrations
7. ✅ Verify all services are healthy

**Estimated time:** 5-10 minutes (depending on your server speed)

### Option 2: Manual Step-by-Step Deployment

If you prefer to run steps manually or if the automated script fails:

#### Step 1: Install Docker

```bash
# Download and install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Start Docker
systemctl start docker
systemctl enable docker

# Verify installation
docker --version
docker compose version
```

#### Step 2: Navigate to Project Directory

```bash
cd /home/user/rowlyknit
```

#### Step 3: Create Root Environment File

Create `/home/user/rowlyknit/.env`:

```bash
cat > .env << 'EOF'
# Database Configuration
DB_NAME=rowly_production
DB_USER=rowly_user
DB_PASSWORD=FMT7sYclnq2Zp+d4aEwn2SpXoywdzBI/fCA+Uei7arA=

# Redis Configuration
REDIS_PASSWORD=JLDsUXWXOypGKAXx+ZyUjKBuhmiB7tI3ra5U91dHRyc=

# Frontend Configuration
VITE_API_URL=https://rowlyknit.com
EOF
```

#### Step 4: Verify Backend Environment File

```bash
# Check if backend/.env exists
ls -la backend/.env

# If it doesn't exist, the deployment script will create it
```

#### Step 5: Build Containers

```bash
cd /home/user/rowlyknit
docker compose build --no-cache
```

This will build:
- PostgreSQL 16 container
- Redis 7 container
- Node.js backend container
- React frontend container
- Nginx reverse proxy container

#### Step 6: Start All Services

```bash
docker compose up -d
```

#### Step 7: Wait for Services

```bash
# Wait for PostgreSQL to be ready
sleep 10

# Check PostgreSQL is ready
docker compose exec postgres pg_isready -U rowly_user -d rowly_production
```

#### Step 8: Run Database Migrations

```bash
docker compose exec -T backend npm run migrate
```

#### Step 9: Verify Deployment

```bash
# Check all containers are running
docker compose ps

# Test backend
curl http://localhost:5000/health

# Test frontend
curl http://localhost:3000

# View logs
docker compose logs -f
```

## What Gets Deployed

### Services

1. **PostgreSQL** (`rowly_postgres`)
   - Port: 127.0.0.1:5432 (localhost only)
   - Database: `rowly_production`
   - User: `rowly_user`
   - Data persisted in Docker volume

2. **Redis** (`rowly_redis`)
   - Port: 127.0.0.1:6379 (localhost only)
   - Used for rate limiting and caching
   - Data persisted in Docker volume

3. **Backend API** (`rowly_backend`)
   - Port: 127.0.0.1:5000 (localhost only)
   - Node.js/Express application
   - Connects to PostgreSQL and Redis

4. **Frontend** (`rowly_frontend`)
   - Port: 127.0.0.1:3000 (localhost only)
   - React/Vite application
   - Served via Nginx

5. **Nginx** (`rowly_nginx`)
   - Ports: 80, 443 (public)
   - Reverse proxy
   - SSL termination
   - Static file serving

### Network Architecture

```
Internet
   ↓
Nginx (:80, :443) ← Public
   ↓
Frontend (:3000) ← localhost only
   ↓
Backend (:5000) ← localhost only
   ↓
PostgreSQL (:5432) ← localhost only
Redis (:6379) ← localhost only
```

### Data Persistence

Docker volumes ensure your data persists across container restarts:
- `postgres_data` - Database files
- `redis_data` - Redis persistence
- `./backend/uploads` - User uploaded files
- `./backups` - Database backups

## Managing Your Deployment

### View Status

```bash
cd /home/user/rowlyknit
docker compose ps
```

### View Logs

```bash
# All logs
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
docker compose logs -f nginx
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart backend
docker compose restart frontend
```

### Stop Services

```bash
cd /home/user/rowlyknit
docker compose down
```

**Note:** This stops containers but preserves data volumes.

### Start Services

```bash
cd /home/user/rowlyknit
docker compose up -d
```

### Update Application

```bash
cd /home/user/rowlyknit

# Pull latest code
git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy

# Rebuild and restart
docker compose build --no-cache
docker compose up -d --force-recreate

# Run any new migrations
docker compose exec -T backend npm run migrate
```

## Database Operations

### Access Database Shell

```bash
cd /home/user/rowlyknit
docker compose exec postgres psql -U rowly_user -d rowly_production
```

### Backup Database

```bash
cd /home/user/rowlyknit
docker compose exec postgres pg_dump -U rowly_user rowly_production > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database

```bash
cd /home/user/rowlyknit
docker compose exec -T postgres psql -U rowly_user rowly_production < backup_20251120_123456.sql
```

### Run Migrations

```bash
cd /home/user/rowlyknit
docker compose exec -T backend npm run migrate
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs [service-name]

# Try rebuilding
docker compose build --no-cache [service-name]
docker compose up -d [service-name]
```

### Database Connection Issues

```bash
# Check if PostgreSQL is ready
docker compose exec postgres pg_isready -U rowly_user

# Restart database
docker compose restart postgres

# Restart backend
docker compose restart backend

# Check backend logs
docker compose logs backend --tail=50
```

### Migration Fails

```bash
# Check backend can reach database
docker compose exec backend sh -c "nc -zv postgres 5432"

# Check database logs
docker compose logs postgres

# Try running migration manually
docker compose exec backend sh
cd /app
npm run migrate
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Remove unused Docker images
docker image prune -a

# Clean up Docker system (careful!)
docker system prune
```

### Frontend Not Loading

```bash
# Check frontend logs
docker compose logs frontend

# Rebuild frontend
docker compose build --no-cache frontend
docker compose up -d --force-recreate frontend
```

### Nginx/SSL Issues

```bash
# Check nginx logs
docker compose logs nginx

# Verify SSL certificates exist
ls -la deployment/ssl/

# Restart nginx
docker compose restart nginx
```

## Health Checks

### Check All Services

```bash
cd /home/user/rowlyknit
bash scripts/deployment/diagnose-production.sh
```

### Manual Health Checks

```bash
# Backend
curl http://localhost:5000/health

# Frontend
curl http://localhost:3000

# PostgreSQL
docker compose exec postgres pg_isready -U rowly_user -d rowly_production

# Redis
docker compose exec redis redis-cli -a "$(grep REDIS_PASSWORD .env | cut -d= -f2)" ping

# Public site (if SSL configured)
curl https://rowlyknit.com
```

## Performance Monitoring

### Container Resource Usage

```bash
# Real-time stats
docker stats

# Disk usage
docker system df
```

### Application Logs

```bash
# Watch for errors
docker compose logs -f | grep -i error

# Watch backend logs
docker compose logs -f backend
```

## Security Notes

- All internal ports (5000, 3000, 5432, 6379) are bound to `127.0.0.1` only
- Only Nginx ports (80, 443) are publicly accessible
- Database and Redis passwords are stored in environment files
- SSL certificates should be properly configured for production
- Keep Docker and images updated regularly

## Next Steps After Deployment

1. **Verify All Services**
   ```bash
   docker compose ps
   curl http://localhost:5000/health
   curl http://localhost:3000
   ```

2. **Configure SSL/HTTPS**
   - Ensure SSL certificates are in `deployment/ssl/`
   - Verify nginx configuration
   - Test HTTPS: `curl https://rowlyknit.com`

3. **Set Up Monitoring**
   - Check application logs regularly
   - Monitor disk space and memory usage
   - Set up automated backups

4. **Test the Application**
   - Register a test user
   - Create a test project
   - Upload test photos
   - Verify all features work

## Support

For more detailed information:
- Quick Reference: `PRODUCTION_QUICK_REFERENCE.md`
- Full Status: `PRODUCTION_DEPLOYMENT_STATUS.md`
- Diagnostics: `bash scripts/deployment/diagnose-production.sh`

## Common Commands Quick Reference

```bash
# Deploy/Update
cd /home/user/rowlyknit && bash scripts/deployment/DEPLOY_FULL_STACK_WITH_DOCKER.sh

# Status
docker compose ps

# Logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose down

# Start
docker compose up -d

# Database shell
docker compose exec postgres psql -U rowly_user -d rowly_production

# Backend shell
docker compose exec backend sh
```

---

**Remember:** Always run docker compose commands from `/home/user/rowlyknit` directory!
