# Rowly Production Deployment Instructions

## ✅ PRE-DEPLOYMENT CHECKLIST

All code changes have been committed and pushed to:
- **Branch**: `claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy`
- **Latest Commit**: `7dba934`

### Critical Fixes Deployed:
1. ✅ Counter link creation (field name mismatch fixed)
2. ✅ Counter creation validation (camelCase field names)
3. ✅ PDF viewer worker files (added to public directory)

### Production Builds Completed:
- ✅ Backend built successfully (`backend/dist/`)
- ✅ Frontend built successfully (`frontend/dist/`)
- ✅ PDF worker files included in build

---

## 🚀 DEPLOYMENT OPTIONS

You have two deployment methods available:

### Option 1: Docker Deployment (Recommended)

**Prerequisites on Production Server:**
- Docker and Docker Compose installed
- Domain DNS configured
- Environment files configured

**Deploy Command:**
```bash
# On your production server
cd /path/to/rowlyknit
git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
docker-compose up -d --build
```

### Option 2: PM2 Deployment

**Prerequisites on Production Server:**
- Node.js 18.x installed
- PM2 installed globally
- PostgreSQL and Redis running
- Nginx configured
- Environment files configured

**Deploy Command:**
```bash
# On your production server (as root or with sudo)
cd /home/user/rowlyknit
sudo bash deployment/scripts/deploy-production.sh update
```

---

## 📋 DETAILED DEPLOYMENT STEPS

### For Docker Deployment:

1. **SSH into your production server**
   ```bash
   ssh user@rowlyknit.com
   ```

2. **Navigate to application directory**
   ```bash
   cd /home/user/rowlyknit  # or your app directory
   ```

3. **Pull latest code**
   ```bash
   git fetch origin
   git checkout claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
   git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
   ```

4. **Verify environment files exist**
   ```bash
   ls -la backend/.env
   ls -la frontend/.env.production
   ```

5. **Deploy with Docker**
   ```bash
   # Stop existing containers
   docker-compose down

   # Build and start new containers
   docker-compose up -d --build

   # Check status
   docker-compose ps
   docker-compose logs -f
   ```

6. **Verify health**
   ```bash
   curl http://localhost:5000/health
   curl http://localhost
   ```

### For PM2 Deployment:

1. **SSH into your production server**
   ```bash
   ssh user@rowlyknit.com
   ```

2. **Run deployment script**
   ```bash
   cd /home/user/rowlyknit
   sudo bash deployment/scripts/deploy-production.sh update
   ```

   The script will automatically:
   - ✅ Pull latest code from your branch
   - ✅ Install/update dependencies
   - ✅ Build backend and frontend
   - ✅ Run database migrations
   - ✅ Restart PM2 services
   - ✅ Reload Nginx
   - ✅ Run health checks

3. **Monitor deployment**
   ```bash
   # Check PM2 status
   pm2 status

   # View logs
   pm2 logs rowly-backend --lines 50

   # Monitor in real-time
   pm2 monit
   ```

---

## 🔍 POST-DEPLOYMENT VERIFICATION

### 1. Check Services Health
```bash
# Backend health
curl https://api.rowlyknit.com/health

# Frontend accessibility
curl https://rowlyknit.com

# Database connectivity (from backend container/server)
psql -h postgres -U rowly_user -d rowly_production -c "SELECT COUNT(*) FROM projects;"
```

### 2. Test Critical Features

Visit your production site and test:
- ✅ **Counter Creation**: Create a new counter on any project
- ✅ **Counter Links**: Create a counter link (this was completely broken before)
- ✅ **PDF Viewer**: Upload and view a pattern PDF
- ✅ **Counter Updates**: Increment/decrement existing counters

### 3. Monitor Logs
```bash
# Docker:
docker-compose logs -f backend
docker-compose logs -f frontend

# PM2:
pm2 logs rowly-backend --lines 100
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 🐛 TROUBLESHOOTING

### Counter Links Still Not Working?
1. Check browser console for API errors
2. Verify backend logs: `docker-compose logs backend` or `pm2 logs`
3. Test API directly:
   ```bash
   curl -X POST https://api.rowlyknit.com/api/projects/{PROJECT_ID}/counter-links \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer {TOKEN}" \
     -d '{
       "sourceCounterId": "xxx",
       "targetCounterId": "yyy",
       "linkType": "reset_on_target",
       "triggerCondition": {"type": "equals", "value": 8},
       "action": {"type": "reset", "value": 1},
       "isActive": true
     }'
   ```

### PDF Viewer Not Loading?
1. Verify worker files exist in frontend build:
   ```bash
   ls -la frontend/dist/pdf.worker.min.*
   ```
2. Check browser console for worker errors
3. Verify Nginx is serving static files correctly

### Database Migration Errors?
```bash
# Docker:
docker-compose exec backend npm run migrate

# PM2:
cd /home/user/rowlyknit/backend && npm run migrate
```

---

## 🔄 ROLLBACK PROCEDURE

If something goes wrong:

### Docker Rollback:
```bash
# Stop current containers
docker-compose down

# Checkout previous commit
git checkout 5f1a354  # previous working commit

# Rebuild and restart
docker-compose up -d --build
```

### PM2 Rollback:
```bash
# Restore from backup (if created by deploy script)
ls -la /backups/pre_deploy_*.sql.gz

# Checkout previous code
git checkout 5f1a354

# Rebuild and restart
npm run build --prefix backend
npm run build --prefix frontend
pm2 restart all
```

---

## 📊 MONITORING & MAINTENANCE

### Check Application Status
```bash
# Docker:
docker-compose ps
docker stats

# PM2:
pm2 status
pm2 monit
```

### View Resource Usage
```bash
# System resources
htop

# Database size
docker-compose exec postgres psql -U rowly_user -d rowly_production -c "
  SELECT pg_size_pretty(pg_database_size('rowly_production'));
"

# Disk usage
df -h
du -sh /home/user/rowlyknit
```

### Backup Before Changes
```bash
# Manual backup
docker-compose exec postgres pg_dump -U rowly_user rowly_production | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

---

## 🎉 SUCCESS CRITERIA

Deployment is successful when:
- ✅ All Docker containers are running (or PM2 services are online)
- ✅ Health endpoint returns 200 OK
- ✅ Frontend loads without errors
- ✅ You can create a new counter
- ✅ You can create a counter link
- ✅ PDF patterns load and display correctly
- ✅ No errors in application logs

---

## 📞 SUPPORT

If you encounter issues:
1. Check logs first (see Troubleshooting section)
2. Verify all environment variables are set correctly
3. Ensure database migrations have run successfully
4. Check firewall rules and port accessibility

---

**Deployment Prepared By**: Claude Code Assistant
**Date**: 2025-11-14
**Branch**: claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
**Commit**: 7dba934
