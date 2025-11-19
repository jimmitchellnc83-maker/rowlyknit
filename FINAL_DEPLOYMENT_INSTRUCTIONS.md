# 🚀 Final Deployment Instructions for Rowly Production

## ✅ What We've Done

1. ✅ **Fixed all security vulnerabilities**
   - Updated react-pdf (HIGH severity PDF.js vulnerability)
   - Updated nodemailer, multer, vite, vitest
   - Frontend: 0 vulnerabilities (down from 8)

2. ✅ **Added ESLint configuration**
   - Backend and frontend now have proper linting

3. ✅ **Pushed all changes to GitHub**
   - Branch: `claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy`
   - Commit: `20c6cf0`

4. ✅ **Generated secure production secrets**
   - See `PRODUCTION_SECRETS.env` file

5. ✅ **Created deployment script**
   - `DEPLOY_TO_PRODUCTION_NOW.sh`

---

## 📋 Pre-Deployment Checklist

Before deploying, ensure you have:

- [ ] SSH access to your production server
- [ ] Server address: `your-server-ip` or `rowlyknit.com`
- [ ] Docker installed on server
- [ ] SSL certificates configured
- [ ] Domain DNS pointing to server

---

## 🚀 Deployment Steps

### Step 1: Copy Files to Server

```bash
# On your local machine, copy the deployment files
scp DEPLOY_TO_PRODUCTION_NOW.sh PRODUCTION_SECRETS.env user@your-server:/home/user/rowlyknit/
```

### Step 2: SSH into Server

```bash
ssh user@your-server-ip
cd /home/user/rowlyknit
```

### Step 3: Configure Environment

```bash
# Copy the production secrets to backend
cp PRODUCTION_SECRETS.env backend/.env

# IMPORTANT: Edit if you want email features
nano backend/.env
# Update EMAIL_API_KEY with your SendGrid/Postmark/SES key

# Secure the file
chmod 600 backend/.env
```

### Step 4: Run Deployment

```bash
# Make script executable
chmod +x DEPLOY_TO_PRODUCTION_NOW.sh

# Run deployment
./DEPLOY_TO_PRODUCTION_NOW.sh
```

The script will:
- ✅ Pull latest code from GitHub
- ✅ Check environment files
- ✅ Build Docker containers
- ✅ Stop old containers
- ✅ Start new containers
- ✅ Run database migrations
- ✅ Perform health checks

---

## 🔍 Verify Deployment

### 1. Check Container Status

```bash
docker compose ps
```

All services should show "Up" and "healthy".

### 2. Check Logs

```bash
# All logs
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx
```

### 3. Test Endpoints

```bash
# Backend health
curl http://localhost:5000/health

# Frontend
curl http://localhost:3000

# Via nginx
curl http://localhost/health

# Production URLs (if DNS configured)
curl https://rowlyknit.com
curl https://api.rowlyknit.com/health
```

---

## 🛠️ Common Issues & Solutions

### Issue: Containers won't start

```bash
# Check what's wrong
docker compose logs

# Rebuild from scratch
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Issue: Database connection failed

```bash
# Check PostgreSQL
docker compose ps postgres
docker compose logs postgres

# Verify credentials match between docker-compose.yml and backend/.env
docker compose exec postgres psql -U rowly_user -d rowly_production
```

### Issue: Migrations failed

```bash
# Run migrations manually
docker compose exec backend npm run migrate

# Check migration status
docker compose exec backend npx knex migrate:status
```

### Issue: Nginx 502 Bad Gateway

```bash
# Check backend is running
docker compose ps backend

# Check backend logs
docker compose logs backend

# Restart backend
docker compose restart backend
```

---

## 📊 Useful Commands

### Container Management

```bash
# View all containers
docker compose ps

# Restart specific service
docker compose restart backend
docker compose restart frontend

# Stop all
docker compose down

# Start all
docker compose up -d

# View logs
docker compose logs -f [service]
```

### Database Operations

```bash
# Connect to database
docker compose exec postgres psql -U rowly_user -d rowly_production

# Backup database
docker compose exec -T postgres pg_dump -U rowly_user rowly_production | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore database
gunzip < backup.sql.gz | docker compose exec -T postgres psql -U rowly_user -d rowly_production
```

### Application Management

```bash
# Run migrations
docker compose exec backend npm run migrate

# Rollback migration
docker compose exec backend npm run migrate:rollback

# View backend environment
docker compose exec backend printenv
```

---

## 🔐 Security Best Practices

1. **Rotate secrets regularly**
   - Generate new JWT secrets every 90 days
   - Update backend/.env and restart

2. **Monitor logs**
   ```bash
   docker compose logs -f | grep -i error
   ```

3. **Keep backups**
   ```bash
   # Automated backup (runs hourly if BACKUP_ENABLED=true in .env)
   docker compose exec backend npm run backup
   ```

4. **Update regularly**
   ```bash
   git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
   ./DEPLOY_TO_PRODUCTION_NOW.sh
   ```

---

## 📱 Testing Your Deployment

### 1. Test Registration

```bash
curl -X POST https://api.rowlyknit.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "SecurePassword123!"
  }'
```

### 2. Test Login

```bash
curl -X POST https://api.rowlyknit.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!"
  }'
```

### 3. Test Frontend

- Visit https://rowlyknit.com
- Try registering a new account
- Create a test project
- Test counter functionality

---

## 🎉 Success!

Your Rowly app is now deployed to production with:
- ✅ All security vulnerabilities fixed
- ✅ Latest code from GitHub
- ✅ Secure production secrets
- ✅ Docker containerized deployment
- ✅ SSL certificates configured
- ✅ Database migrations applied

### Next Steps

1. **Set up monitoring**
   - Configure Sentry (add SENTRY_DSN to .env)
   - Set up uptime monitoring (UptimeRobot, Pingdom)

2. **Configure email** (optional)
   - Add EMAIL_API_KEY to backend/.env
   - Test with password reset feature

3. **Set up backups**
   - Backups run hourly by default
   - Verify: `ls -lh /backups`

4. **Add SSL monitoring**
   - Check certificate expiry
   - Set up auto-renewal

---

## 📞 Support

If you encounter issues:

1. Check logs: `docker compose logs -f`
2. Review health: `docker compose ps`
3. Check documentation: `README.md`, `DOCKER_PRODUCTION_GUIDE.md`

---

**🎊 Congratulations! Your Rowly knitting app is live!**
