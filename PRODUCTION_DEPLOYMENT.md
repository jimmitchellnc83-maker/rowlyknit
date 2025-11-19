# 🚀 Production Deployment Guide for Rowly

## Prerequisites

Before deploying, ensure you have:
- SSH access to production server: `ssh root@165.227.97.4`
- Domain DNS configured: `rowlyknit.com` pointing to `165.227.97.4`
- Email API key (SendGrid/Postmark) for email functionality

## Deployment Steps

### Step 1: SSH into Production Server

```bash
ssh root@165.227.97.4
```

### Step 2: Clone or Update Repository

If this is the first deployment:
```bash
cd /home/user
git clone https://github.com/jimmitchellnc83-maker/rowlyknit.git
cd rowlyknit
```

If updating an existing deployment:
```bash
cd /home/user/rowlyknit
git fetch origin
git checkout claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
```

### Step 3: Configure Environment Variables

A production `.env` file has been created locally with secure credentials. You need to create it on the server:

```bash
cd /home/user/rowlyknit/backend
nano .env
```

Copy and paste the following content (with secure credentials already generated):

```env
# Application
NODE_ENV=production
PORT=5000
APP_NAME=Rowly
APP_URL=https://rowlyknit.com
API_VERSION=v1

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=rowly_production
DB_USER=rowly_user
DB_PASSWORD=w7kJ2mPx8vRq4hNz9aFb
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=p3Lm9xTq5nKr8bHw
REDIS_DB=0

# JWT & Authentication
JWT_SECRET=B38SCZz8G7PWXtgQWhClIZ4ea4d6vyYNteQkh3EKToo=
JWT_REFRESH_SECRET=ipqHy/3i4ejngPlhy5q2SEL/Mv62F0Y8s8KOIhBR7AE=
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
CSRF_SECRET=XSl40s/F0LGMgix1hvza0oe96esAnnxqv7ERHsjFvcM=

# Session
SESSION_SECRET=fpKGiETFZgQqF1h3bgobQLOVdkB25kBl5jj62LBxmIA=
SESSION_NAME=rowly.sid
SESSION_MAX_AGE=86400000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5
UPLOAD_RATE_LIMIT_MAX=20

# File Upload
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10485760
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/webp
ALLOWED_PDF_TYPES=application/pdf

# Email (SendGrid/Postmark/SES) - ADD YOUR API KEY HERE!
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=YOUR_SENDGRID_API_KEY_HERE
EMAIL_FROM=noreply@rowlyknit.com
EMAIL_FROM_NAME=Rowly
EMAIL_REPLY_TO=support@rowlyknit.com
MAIL_SUBDOMAIN=mail.rowlyknit.com

# Security
BCRYPT_ROUNDS=12
COOKIE_SECURE=true
COOKIE_SAME_SITE=strict
CORS_ORIGIN=https://rowlyknit.com
ALLOWED_ORIGINS=https://rowlyknit.com,https://www.rowlyknit.com

# Monitoring & Logging
LOG_LEVEL=info
SENTRY_DSN=
ENABLE_METRICS=true
METRICS_PORT=9090

# Backup & Recovery
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 * * * *
BACKUP_RETENTION_DAYS=30
BACKUP_STORAGE_PATH=/backups

# GDPR & Compliance
DATA_RETENTION_DAYS=730
ENABLE_ANALYTICS=true
ANALYTICS_PROVIDER=plausible
ANALYTICS_DOMAIN=rowlyknit.com

# Feature Flags
ENABLE_CLOUD_SYNC=false
ENABLE_EMAIL_VERIFICATION=true
ENABLE_TWO_FACTOR=false

# Digital Ocean / Cloud
DO_SPACES_KEY=
DO_SPACES_SECRET=
DO_SPACES_ENDPOINT=
DO_SPACES_BUCKET=rowly-uploads
DO_SPACES_REGION=nyc3
```

**⚠️ IMPORTANT:** Replace `YOUR_SENDGRID_API_KEY_HERE` with your actual SendGrid API key!

Save and exit (Ctrl+X, then Y, then Enter).

### Step 4: Install Docker and Docker Compose (if not already installed)

```bash
# Update system
apt-get update
apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt-get install -y docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### Step 5: Setup SSL Certificates

```bash
cd /home/user/rowlyknit/deployment/scripts
chmod +x setup-ssl.sh
sudo ./setup-ssl.sh
```

This will:
- Install certbot
- Obtain Let's Encrypt SSL certificates for `rowlyknit.com` and `www.rowlyknit.com`
- Setup automatic certificate renewal

### Step 6: Run Initial Server Setup (First Time Only)

If this is your first deployment:

```bash
cd /home/user/rowlyknit/deployment/scripts
chmod +x server-setup.sh
sudo ./server-setup.sh
```

This will install system dependencies and configure the server.

### Step 7: Deploy the Application

```bash
cd /home/user/rowlyknit/deployment/scripts
chmod +x deploy.sh
sudo ./deploy.sh
```

The deploy script will:
1. Pull the latest code from GitHub
2. Create a database backup
3. Stop existing containers
4. Build new Docker images
5. Run database migrations
6. Start all services (PostgreSQL, Redis, Backend, Frontend, Nginx)
7. Run health checks
8. Clean up old images and backups

### Step 8: Verify Deployment

Check that all services are running:

```bash
cd /home/user/rowlyknit
docker compose ps
```

You should see all services with status "Up" and "healthy".

Check the application:
- Frontend: https://rowlyknit.com
- Backend API: https://rowlyknit.com/api
- Health Check: https://rowlyknit.com/health

View logs if needed:
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

### Step 9: Create First User (Optional)

You can create a test user account through the registration page or via API:

```bash
curl -X POST https://rowlyknit.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@rowlyknit.com",
    "password": "Demo123!@#",
    "name": "Demo User"
  }'
```

## Post-Deployment Checklist

- [ ] Application accessible at https://rowlyknit.com
- [ ] SSL certificate valid (green padlock in browser)
- [ ] Login/registration working
- [ ] File uploads working
- [ ] Dark mode toggle working
- [ ] PWA installable (check for "Install" button in browser)
- [ ] Database backups running (check `/backups` directory)
- [ ] Email functionality working (test password reset)

## Monitoring & Maintenance

### View Application Logs
```bash
cd /home/user/rowlyknit
docker compose logs -f backend
```

### View System Resources
```bash
docker stats
```

### Restart Services
```bash
cd /home/user/rowlyknit
docker compose restart
```

### Stop Application
```bash
cd /home/user/rowlyknit
docker compose down
```

### Update Application
When you push new changes to GitHub:
```bash
cd /home/user/rowlyknit/deployment/scripts
sudo ./deploy.sh
```

### Database Backup
Automatic backups run hourly. Manual backup:
```bash
cd /home/user/rowlyknit
docker compose exec -T postgres pg_dump -U rowly_user rowly_production > backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
cd /home/user/rowlyknit
docker compose exec -T postgres psql -U rowly_user rowly_production < backup_YYYYMMDD.sql
```

## Troubleshooting

### Services Won't Start
```bash
cd /home/user/rowlyknit
docker compose down
docker compose up -d
docker compose logs -f
```

### Database Connection Issues
Check database logs:
```bash
docker compose logs postgres
```

Verify .env file has correct credentials:
```bash
cat /home/user/rowlyknit/backend/.env | grep DB_
```

### Port Already in Use
```bash
# Check what's using the port
sudo lsof -i :80
sudo lsof -i :443
sudo lsof -i :5000

# Stop conflicting services
sudo systemctl stop nginx  # if system nginx is running
```

### SSL Certificate Issues
```bash
# Test certificate renewal
certbot renew --dry-run

# Regenerate certificates
cd /home/user/rowlyknit/deployment/scripts
sudo ./setup-ssl.sh
```

### Clear Everything and Start Fresh
```bash
cd /home/user/rowlyknit
docker compose down -v  # WARNING: This deletes all data!
rm -rf backend/uploads/*
sudo ./deployment/scripts/deploy.sh
```

## Security Notes

1. **Secrets Management**: The `.env` file contains sensitive credentials. Never commit it to git.
2. **Database Passwords**: Change the default passwords after first deployment
3. **Email API Key**: Required for user registration and password reset functionality
4. **Firewall**: Ensure only ports 80, 443, and 22 (SSH) are open
5. **Updates**: Regularly update Docker images and system packages

## Support

If you encounter issues:
1. Check logs: `docker compose logs -f`
2. Check GitHub Issues: https://github.com/jimmitchellnc83-maker/rowlyknit/issues
3. Review deployment docs: `/home/user/rowlyknit/docs/DEPLOYMENT.md`

---

**Server Details:**
- IP: 165.227.97.4
- Domain: rowlyknit.com
- Branch: claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy

**Deployment Date:** $(date)
