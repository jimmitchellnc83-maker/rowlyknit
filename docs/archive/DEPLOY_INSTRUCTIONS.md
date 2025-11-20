# Quick Production Deployment Instructions

## Current Build Status

✅ **Frontend build completed successfully**
- Location: `/home/user/rowlyknit/frontend/dist/`
- Size: 7.5MB
- Status: Production-ready

## Deployment Methods

### Method 1: Automated Deployment (Recommended)

On your **production server**, run:

```bash
cd /home/user/rowlyknit
git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
./QUICK_DEPLOY.sh
```

### Method 2: Manual Deployment

If you prefer manual control, follow these steps:

#### Step 1: Navigate to Project Directory
```bash
cd /home/user/rowlyknit
```

#### Step 2: Pull Latest Code
```bash
git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
```

#### Step 3: Build Frontend
```bash
cd frontend
npm install
npm run build
```

#### Step 4: Deploy to Nginx
```bash
# Copy built files to nginx serving directory
sudo mkdir -p /var/www/rowlyknit
sudo cp -r dist/* /var/www/rowlyknit/
sudo chown -R www-data:www-data /var/www/rowlyknit
sudo chmod -R 755 /var/www/rowlyknit
```

#### Step 5: Build and Deploy Backend
```bash
cd ../backend
npm install --only=production
npm run build
npm run migrate  # Run database migrations
```

#### Step 6: Restart Services
```bash
# Restart backend (using PM2)
pm2 restart rowly-backend

# Restart Nginx
sudo systemctl restart nginx
```

### Method 3: Docker Deployment

If using Docker Compose:

```bash
cd /home/user/rowlyknit
git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy

# Rebuild and restart frontend container
docker compose build frontend
docker compose up -d frontend

# Rebuild and restart backend if needed
docker compose build backend
docker compose up -d backend
```

## Verification Steps

After deployment, verify everything is working:

### 1. Check Services
```bash
# Check PM2 backend status
pm2 status

# Check Docker containers (if using Docker)
docker ps

# Check Nginx
sudo systemctl status nginx
```

### 2. Test Endpoints
```bash
# Test frontend
curl https://rowlyknit.com

# Test API health
curl https://api.rowlyknit.com/health

# Test API with authentication (replace with actual token)
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.rowlyknit.com/api/projects
```

### 3. Check Logs
```bash
# PM2 logs
pm2 logs rowly-backend --lines 50

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Docker logs (if using Docker)
docker logs rowly_frontend
docker logs rowly_backend
```

## Common Issues and Solutions

### Issue: "npm ERR! ENOENT"
**Solution**: Make sure you're in the correct directory (`/home/user/rowlyknit`)

### Issue: "fatal: not a git repository"
**Solution**: Navigate to the project directory first:
```bash
cd /home/user/rowlyknit
```

### Issue: "Permission denied" when copying to nginx
**Solution**: Use `sudo`:
```bash
sudo cp -r dist/* /var/www/rowlyknit/
```

### Issue: PM2 not found
**Solution**: Install PM2 globally:
```bash
sudo npm install -g pm2
```

### Issue: Docker command not found
**Solution**: Install Docker:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

## Nginx Configuration

Ensure your Nginx configuration points to the correct directory:

```nginx
server {
    listen 443 ssl http2;
    server_name rowlyknit.com;

    root /var/www/rowlyknit;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Location: `/etc/nginx/sites-available/rowlyknit`

## Environment Variables

Before deployment, ensure these environment variables are set:

### Backend (.env)
```bash
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rowly_production
DB_USER=rowly_user
DB_PASSWORD=your_secure_password
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=https://rowlyknit.com
```

### Frontend (.env.production)
```bash
VITE_API_URL=https://api.rowlyknit.com
VITE_WS_URL=wss://api.rowlyknit.com
VITE_APP_NAME=Rowly
```

## Post-Deployment Checklist

- [ ] Frontend accessible at https://rowlyknit.com
- [ ] API accessible at https://api.rowlyknit.com
- [ ] SSL certificates valid
- [ ] Database migrations completed
- [ ] Backend service running (PM2 or Docker)
- [ ] Nginx serving files correctly
- [ ] WebSocket connections working
- [ ] File uploads working
- [ ] User registration/login working

## Support

For detailed deployment instructions, see:
- `PRODUCTION_DEPLOYMENT_GUIDE.md` - Complete production setup
- `DOCKER_PRODUCTION_GUIDE.md` - Docker-specific deployment

## Quick Reference

| Command | Purpose |
|---------|---------|
| `./QUICK_DEPLOY.sh` | Automated deployment |
| `npm run build` | Build frontend |
| `pm2 restart rowly-backend` | Restart backend |
| `sudo systemctl restart nginx` | Restart Nginx |
| `docker compose up -d` | Start all Docker services |
| `pm2 logs` | View backend logs |
| `pm2 status` | Check backend status |

---

**Last Updated**: 2025-11-19
**Build Location**: `/home/user/rowlyknit/frontend/dist/`
**Branch**: `claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy`
