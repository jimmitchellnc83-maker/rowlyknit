# Rowly Production Deployment Guide

## Complete Production Deployment Instructions

This guide provides step-by-step instructions for deploying the complete Rowly knitting app to production.

---

## 🎯 Pre-Deployment Checklist

### 1. Environment Preparation
- [ ] Production server provisioned (minimum 2GB RAM, 2 CPUs)
- [ ] Domain name configured (rowlyknit.com)
- [ ] SSL certificates ready (Let's Encrypt recommended)
- [ ] PostgreSQL 16+ installed or accessible
- [ ] Redis 7+ installed or accessible
- [ ] Node.js 18+ installed
- [ ] Docker & Docker Compose installed (if using containerization)

### 2. Code Preparation
- [ ] All database migrations created and tested
- [ ] Environment variables configured
- [ ] Frontend build tested locally
- [ ] Backend tests passing
- [ ] Security audit completed

### 3. Third-Party Services
- [ ] Email service API key (SendGrid, AWS SES, etc.)
- [ ] File storage configured (AWS S3, DigitalOcean Spaces, local storage)
- [ ] CDN configured (Cloudflare recommended)
- [ ] Backup storage configured

---

## 📦 Step 1: Server Setup

### Initial Server Configuration

```bash
# SSH into your server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install dependencies
apt install -y curl git build-essential

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify installations
node --version  # Should be v18.x
npm --version   # Should be v9.x

# Create application user
adduser --system --group rowly
usermod -aG sudo rowly
```

### Install PostgreSQL

```bash
# Install PostgreSQL 16
apt install -y postgresql postgresql-contrib

# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE rowly_production;
CREATE USER rowly_user WITH ENCRYPTED PASSWORD 'YOUR_SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE rowly_production TO rowly_user;
ALTER DATABASE rowly_production OWNER TO rowly_user;
\c rowly_production
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\q
EOF
```

### Install Redis

```bash
# Install Redis
apt install -y redis-server

# Configure Redis for production
nano /etc/redis/redis.conf
# Set: bind 127.0.0.1
# Set: requirepass YOUR_REDIS_PASSWORD
# Set: maxmemory 256mb
# Set: maxmemory-policy allkeys-lru

# Restart Redis
systemctl restart redis
systemctl enable redis

# Test Redis
redis-cli
> AUTH YOUR_REDIS_PASSWORD
> PING  # Should return PONG
> EXIT
```

---

## 📥 Step 2: Deploy Application Code

### Clone Repository

```bash
# Switch to application user
su - rowly

# Create application directory
mkdir -p /home/rowly/rowlyknit
cd /home/rowly/rowlyknit

# Clone repository
git clone https://github.com/jimmitchellnc83-maker/rowlyknit.git .
git checkout main  # or your production branch
```

### Install Dependencies

```bash
# Backend dependencies
cd backend
npm ci --only=production

# Frontend dependencies
cd ../frontend
npm ci
```

---

## ⚙️ Step 3: Configure Environment Variables

### Backend Environment

```bash
cd /home/rowly/rowlyknit/backend
cp .env.example .env
nano .env
```

**Production .env Configuration:**

```env
# Server
NODE_ENV=production
PORT=5000
API_URL=https://api.rowlyknit.com
FRONTEND_URL=https://rowlyknit.com

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rowly_production
DB_USER=rowly_user
DB_PASSWORD=YOUR_SECURE_DATABASE_PASSWORD

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=YOUR_REDIS_PASSWORD

# JWT
JWT_SECRET=YOUR_32_CHARACTER_RANDOM_STRING_HERE
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp,application/pdf

# Email (choose your provider)
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=YOUR_SENDGRID_API_KEY
EMAIL_FROM=noreply@rowlyknit.com
EMAIL_FROM_NAME=Rowly Knitting App

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_MAX=5

# Session
SESSION_SECRET=YOUR_SESSION_SECRET_HERE
SESSION_COOKIE_MAX_AGE=604800000

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# CORS
CORS_ORIGIN=https://rowlyknit.com

# SSL/Security
TRUST_PROXY=true
FORCE_HTTPS=true
```

### Frontend Environment

```bash
cd /home/rowly/rowlyknit/frontend
nano .env.production
```

```env
VITE_API_URL=https://api.rowlyknit.com
VITE_WS_URL=wss://api.rowlyknit.com
VITE_APP_NAME=Rowly
VITE_APP_URL=https://rowlyknit.com
```

---

## 🗄️ Step 4: Run Database Migrations

```bash
cd /home/rowly/rowlyknit/backend

# Run all migrations
npm run migrate

# Verify migrations
npm run migrate:status

# Optional: Seed sample data (ONLY for testing)
# npm run seed
```

**Expected Migrations:**
1. `20240101000001_create_users_table.ts`
2. `20240101000002_create_projects_table.ts`
3. `20240101000003_create_project_photos_table.ts`
4. `20240101000004_create_counters_table.ts`
5. `20240101000005_create_patterns_table.ts`
6. `20240101000006_create_yarn_table.ts`
7. `20240101000007_create_tools_table.ts`
8. `20240101000008_create_recipients_table.ts`
9. `20240101000009_create_audit_log_table.ts`
10. `20240101000010_create_gdpr_tables.ts`
11. `20240101000011_create_pattern_files_table.ts`
12. `20240101000012_create_yarn_photos_table.ts`
13. `20240101000013_add_counter_enhancements.ts`
14. `20240101000014_create_counter_links_table.ts`
15. `20240101000015_create_session_tables.ts`
16. `20240101000016_create_pattern_enhancement_tables.ts`
17. `20240101000017_create_notes_and_alerts_tables.ts`

---

## 🏗️ Step 5: Build Frontend

```bash
cd /home/rowly/rowlyknit/frontend

# Build for production
npm run build

# Verify build
ls -la dist/
```

---

## 🔧 Step 6: Set Up Process Management

### Install PM2

```bash
npm install -g pm2
```

### Create PM2 Ecosystem File

```bash
cd /home/rowly/rowlyknit
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'rowly-backend',
      script: './backend/dist/server.js',
      cwd: '/home/rowly/rowlyknit/backend',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
    },
  ],
};
```

### Build and Start Backend

```bash
cd /home/rowly/rowlyknit/backend

# Build TypeScript
npm run build

# Start with PM2
pm2 start ../ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Follow the instructions provided

# Check status
pm2 status
pm2 logs rowly-backend --lines 50
```

---

## 🌐 Step 7: Configure Nginx

### Install Nginx

```bash
apt install -y nginx
```

### Create Nginx Configuration

```bash
nano /etc/nginx/sites-available/rowlyknit
```

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name rowlyknit.com www.rowlyknit.com;

    return 301 https://rowlyknit.com$request_uri;
}

# API Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.rowlyknit.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.rowlyknit.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.rowlyknit.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;

    # Proxy to Backend
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket Support
    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # File Uploads
    client_max_body_size 50M;
}

# Frontend
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name rowlyknit.com www.rowlyknit.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/rowlyknit.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rowlyknit.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Root directory
    root /home/rowly/rowlyknit/frontend/dist;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }
}
```

### Enable Site and Restart Nginx

```bash
# Test configuration
nginx -t

# Create symbolic link
ln -s /etc/nginx/sites-available/rowlyknit /etc/nginx/sites-enabled/

# Restart Nginx
systemctl restart nginx
systemctl enable nginx
```

---

## 🔒 Step 8: Configure SSL with Let's Encrypt

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Obtain certificates
certbot --nginx -d rowlyknit.com -d www.rowlyknit.com
certbot --nginx -d api.rowlyknit.com

# Automatic renewal
certbot renew --dry-run

# Set up auto-renewal cron
crontab -e
# Add: 0 0 * * * certbot renew --quiet && systemctl reload nginx
```

---

## 💾 Step 9: Configure Automated Backups

### Database Backups

```bash
mkdir -p /home/rowly/backups

nano /home/rowly/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/rowly/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="rowly_production"
DB_USER="rowly_user"

# Create backup
pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/rowly_db_$DATE.sql.gz

# Keep only last 30 days of backups
find $BACKUP_DIR -name "rowly_db_*.sql.gz" -mtime +30 -delete

echo "Backup completed: rowly_db_$DATE.sql.gz"
```

```bash
chmod +x /home/rowly/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/rowly/backup-db.sh
```

### File Backups

```bash
nano /home/rowly/backup-files.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/rowly/backups"
DATE=$(date +%Y%m%d_%H%M%S)
SOURCE_DIR="/home/rowly/rowlyknit/backend/uploads"

# Create backup
tar -czf $BACKUP_DIR/rowly_files_$DATE.tar.gz -C /home/rowly/rowlyknit/backend uploads

# Keep only last 30 days
find $BACKUP_DIR -name "rowly_files_*.tar.gz" -mtime +30 -delete

echo "File backup completed: rowly_files_$DATE.tar.gz"
```

```bash
chmod +x /home/rowly/backup-files.sh

# Add to crontab (daily at 3 AM)
crontab -e
# Add: 0 3 * * * /home/rowly/backup-files.sh
```

---

## 📊 Step 10: Configure Monitoring

### Application Monitoring with PM2

```bash
# Install PM2 monitoring
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### System Monitoring

```bash
# Install monitoring tools
apt install -y htop iotop nethogs

# Optional: Install Prometheus node exporter
wget https://github.com/prometheus/node_exporter/releases/download/v1.6.1/node_exporter-1.6.1.linux-amd64.tar.gz
tar xvfz node_exporter-1.6.1.linux-amd64.tar.gz
cp node_exporter-1.6.1.linux-amd64/node_exporter /usr/local/bin/
```

---

## 🔥 Step 11: Configure Firewall

```bash
# Install UFW
apt install -y ufw

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH
ufw allow 22/tcp

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable

# Check status
ufw status verbose
```

---

## ✅ Step 12: Post-Deployment Verification

### Health Checks

```bash
# Check backend health
curl https://api.rowlyknit.com/health

# Check frontend
curl https://rowlyknit.com

# Check database connection
PGPASSWORD=YOUR_PASSWORD psql -U rowly_user -d rowly_production -c "SELECT COUNT(*) FROM users;"

# Check Redis
redis-cli -a YOUR_REDIS_PASSWORD PING
```

### Smoke Tests

1. **Create Account**: Visit https://rowlyknit.com and create an account
2. **Login**: Log in with the account
3. **Create Project**: Create a new knitting project
4. **Add Counter**: Add a counter to the project
5. **Start Session**: Start a knitting session
6. **Upload Photo**: Upload a project photo
7. **Test Offline**: Disconnect network and verify offline mode works

---

## 🚀 Step 13: Deployment Commands Summary

### Quick Deployment Script

Create `/home/rowly/deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting Rowly deployment..."

# Pull latest code
cd /home/rowly/rowlyknit
git pull origin main

# Backend
echo "📦 Building backend..."
cd backend
npm ci --only=production
npm run build

# Frontend
echo "🎨 Building frontend..."
cd ../frontend
npm ci
npm run build

# Run migrations
echo "🗄️ Running database migrations..."
cd ../backend
npm run migrate

# Restart services
echo "♻️  Restarting services..."
pm2 restart rowly-backend

# Reload Nginx
sudo systemctl reload nginx

echo "✅ Deployment complete!"
echo "🔍 Checking status..."
pm2 status
```

```bash
chmod +x /home/rowly/deploy.sh
```

### Deploy New Version

```bash
/home/rowly/deploy.sh
```

---

## 📋 Maintenance Commands

### View Logs

```bash
# PM2 logs
pm2 logs rowly-backend --lines 100

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-16-main.log
```

### Restart Services

```bash
# Restart backend
pm2 restart rowly-backend

# Restart Nginx
systemctl restart nginx

# Restart PostgreSQL
systemctl restart postgresql

# Restart Redis
systemctl restart redis
```

### Database Maintenance

```bash
# Vacuum database
vacuumdb -U rowly_user -d rowly_production --analyze

# Check database size
psql -U rowly_user -d rowly_production -c "SELECT pg_size_pretty(pg_database_size('rowly_production'));"
```

---

## 🔧 Troubleshooting

### Common Issues

**Backend won't start:**
```bash
# Check logs
pm2 logs rowly-backend --err --lines 50

# Check environment variables
pm2 env rowly-backend

# Restart
pm2 restart rowly-backend
```

**Database connection errors:**
```bash
# Test connection
psql -U rowly_user -d rowly_production -h localhost

# Check PostgreSQL status
systemctl status postgresql

# Check pg_hba.conf
nano /etc/postgresql/16/main/pg_hba.conf
```

**Nginx errors:**
```bash
# Test configuration
nginx -t

# Check error logs
tail -f /var/log/nginx/error.log
```

---

## 🎯 Production Checklist

Before going live:

- [ ] All environment variables set correctly
- [ ] Database migrations completed
- [ ] SSL certificates installed and working
- [ ] Backups configured and tested
- [ ] Monitoring set up
- [ ] Firewall configured
- [ ] PM2 auto-restart configured
- [ ] Nginx configured with proper caching
- [ ] Security headers in place
- [ ] Rate limiting configured
- [ ] GDPR compliance verified
- [ ] Error tracking configured
- [ ] Performance tested
- [ ] Security audit completed
- [ ] Documentation updated

---

## 📞 Support

For issues or questions:
- GitHub Issues: https://github.com/jimmitchellnc83-maker/rowlyknit/issues
- Email: support@rowlyknit.com
- Documentation: https://docs.rowlyknit.com

---

Made with ❤️ and 🧶 for knitters, by knitters.
