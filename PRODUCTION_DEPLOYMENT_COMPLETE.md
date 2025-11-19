# Rowly Production Deployment Guide - Digital Ocean

## Complete Production Deployment with Security & Monitoring

This guide covers the complete deployment of Rowly to Digital Ocean with all security features, monitoring, and email configuration.

---

## 🎯 Overview

This deployment includes:
- ✅ **SSL/TLS** with Let's Encrypt & HSTS headers
- ✅ **Security** - Rate limiting, CSRF protection, Helmet.js, Input sanitization
- ✅ **Monitoring** - Prometheus metrics, error tracking, performance monitoring
- ✅ **Email System** - Transactional emails with templates
- ✅ **Automated Backups** - Daily database and file backups
- ✅ **Production Config** - PM2, Nginx, environment variables
- ✅ **Cloudflare Integration** - Optional CDN and additional security

---

## 📋 Pre-Deployment Checklist

### Digital Ocean Setup
- [ ] Digital Ocean Droplet created (minimum 2GB RAM, 2 CPUs, Ubuntu 22.04)
- [ ] SSH access configured
- [ ] Root or sudo access available
- [ ] Firewall configured to allow ports 22, 80, 443

### Domain Configuration
- [ ] Domain name registered (rowlyknit.com)
- [ ] DNS A records configured:
  - `rowlyknit.com` → Your droplet IP
  - `www.rowlyknit.com` → Your droplet IP
  - `api.rowlyknit.com` → Your droplet IP
- [ ] DNS propagation complete (check with `dig rowlyknit.com`)

### Third-Party Services
- [ ] Email service account (SendGrid, Postmark, or AWS SES)
- [ ] Email API key obtained
- [ ] Cloudflare account (optional but recommended)

### Local Preparation
- [ ] All code committed to git
- [ ] Branch name noted: `claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy`
- [ ] Database migrations tested locally
- [ ] Frontend build tested locally

---

## 🚀 Deployment Steps

### Step 1: Initial Server Setup

SSH into your Digital Ocean droplet:

```bash
ssh root@your-droplet-ip
```

Clone the repository:

```bash
git clone https://github.com/jimmitchellnc83-maker/rowlyknit.git /home/user/rowlyknit
cd /home/user/rowlyknit
git checkout claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
```

### Step 2: Configure Environment Variables

#### Backend Configuration

```bash
cd /home/user/rowlyknit/backend
cp .env.production.example .env
nano .env
```

**Required Changes:**
```env
# Database
DB_PASSWORD=<generate-strong-password>

# Redis
REDIS_PASSWORD=<generate-strong-password>

# JWT
JWT_SECRET=<generate-32-character-random-string>

# Session
SESSION_SECRET=<generate-session-secret>

# Email (SendGrid example)
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=<your-sendgrid-api-key>
EMAIL_FROM=noreply@rowlyknit.com

# CORS
CORS_ORIGIN=https://rowlyknit.com
ALLOWED_ORIGINS=https://rowlyknit.com,https://www.rowlyknit.com
```

**Generate secrets:**
```bash
# JWT Secret (32 characters)
openssl rand -base64 32

# Session Secret
openssl rand -base64 64

# Database Password
openssl rand -base64 24
```

#### Frontend Configuration

```bash
cd /home/user/rowlyknit/frontend
cp .env.production.example .env.production
nano .env.production
```

```env
VITE_API_URL=https://api.rowlyknit.com
VITE_WS_URL=wss://api.rowlyknit.com
VITE_APP_URL=https://rowlyknit.com
```

### Step 3: Run Initial Deployment

```bash
cd /home/user/rowlyknit/deployment/scripts
sudo bash deploy-production.sh initial
```

This script will:
1. ✅ Install system dependencies (Node.js, PostgreSQL, Redis, Nginx)
2. ✅ Create application user
3. ✅ Setup PostgreSQL database
4. ✅ Setup Redis
5. ✅ Install application dependencies
6. ✅ Build frontend and backend
7. ✅ Run database migrations
8. ✅ Setup PM2 process manager
9. ✅ Configure Nginx
10. ✅ Setup firewall
11. ✅ Configure monitoring
12. ✅ Setup automated backups

### Step 4: Configure SSL/TLS with Let's Encrypt

After DNS is pointing to your server:

```bash
cd /home/user/rowlyknit/deployment/scripts
sudo bash setup-ssl.sh
```

**Manual SSL Setup (Alternative):**

```bash
# Stop nginx
sudo systemctl stop nginx

# Obtain certificates
sudo certbot certonly --standalone \
  --preferred-challenges http \
  --email admin@rowlyknit.com \
  --agree-tos \
  -d rowlyknit.com \
  -d www.rowlyknit.com \
  -d api.rowlyknit.com

# Update nginx config with certificate paths
sudo nano /etc/nginx/sites-available/rowlyknit

# Start nginx
sudo systemctl start nginx

# Test auto-renewal
sudo certbot renew --dry-run
```

### Step 5: Configure Automated Backups

```bash
cd /home/user/rowlyknit/deployment/scripts
sudo bash setup-backups.sh
```

This sets up:
- Daily database backups at 2:00 AM
- Daily file backups at 3:00 AM
- 30-day retention policy
- Automatic cleanup of old backups

### Step 6: Configure Email DNS Records

Add these DNS records for email deliverability:

#### SPF Record
```
Type: TXT
Name: @
Value: v=spf1 include:sendgrid.net ~all
TTL: 3600
```

#### DKIM Record
Get from your email provider (SendGrid/Postmark):
```
Type: TXT
Name: s1._domainkey
Value: <provided-by-email-service>
TTL: 3600
```

#### DMARC Record
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@rowlyknit.com
TTL: 3600
```

#### Sender Domain Verification
For SendGrid:
```bash
# Go to SendGrid Dashboard → Settings → Sender Authentication
# Follow the wizard to verify rowlyknit.com
# Add the provided DNS records
```

### Step 7: Configure Cloudflare (Optional but Recommended)

1. **Add Site to Cloudflare:**
   - Go to Cloudflare Dashboard
   - Add rowlyknit.com
   - Update nameservers at your domain registrar

2. **Configure SSL/TLS:**
   - SSL/TLS → Overview → Full (Strict)
   - SSL/TLS → Edge Certificates → Always Use HTTPS: ON
   - SSL/TLS → Edge Certificates → Automatic HTTPS Rewrites: ON
   - SSL/TLS → Edge Certificates → Minimum TLS Version: 1.2

3. **Configure Security:**
   - Security → WAF → Enable Managed Rules
   - Security → Bots → Enable Bot Fight Mode
   - Security → Settings → Security Level: Medium
   - Security → Settings → Challenge Passage: 30 minutes

4. **Configure Caching:**
   - Caching → Configuration → Caching Level: Standard
   - Caching → Configuration → Browser Cache TTL: 4 hours
   - Create Page Rules:
     - `rowlyknit.com/api/*` → Cache Level: Bypass
     - `*.rowlyknit.com/*.(jpg|png|gif|css|js)` → Cache Level: Cache Everything

5. **Configure Performance:**
   - Speed → Optimization → Auto Minify: Enable all
   - Speed → Optimization → Brotli: ON
   - Speed → Optimization → Rocket Loader: OFF (conflicts with React)

---

## ✅ Post-Deployment Verification

### Health Checks

```bash
# Check backend health
curl https://api.rowlyknit.com/health

# Check frontend
curl https://rowlyknit.com

# Check SSL
curl -vI https://rowlyknit.com 2>&1 | grep -i ssl

# Check PM2 status
sudo -u rowly pm2 status

# Check Nginx status
sudo systemctl status nginx

# Check PostgreSQL
sudo systemctl status postgresql

# Check Redis
redis-cli -a <your-redis-password> PING
```

### Security Verification

```bash
# Test HSTS headers
curl -I https://rowlyknit.com | grep -i strict

# Test CSRF protection
curl -X POST https://api.rowlyknit.com/api/auth/login

# Test rate limiting
for i in {1..20}; do curl https://api.rowlyknit.com/api/auth/login; done

# SSL Labs test
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=rowlyknit.com
```

### Monitoring Checks

```bash
# View Prometheus metrics
curl http://localhost:5000/metrics

# View application logs
sudo -u rowly pm2 logs rowly-backend

# View Nginx logs
sudo tail -f /var/log/nginx/rowlyknit.com.access.log
sudo tail -f /var/log/nginx/rowlyknit.com.error.log

# View backup logs
sudo tail -f /var/log/rowly-backup.log
```

### Email Testing

```bash
# Test email configuration (from application)
# Register a new account at https://rowlyknit.com/register
# Check if welcome email arrives

# Test password reset
# Go to https://rowlyknit.com/forgot-password
# Request password reset
# Check if email arrives
```

### Functional Testing

1. **User Registration:**
   - Visit https://rowlyknit.com/register
   - Create new account
   - Verify email received
   - Confirm email verification works

2. **User Login:**
   - Login with credentials
   - Verify JWT authentication works
   - Check session persistence

3. **Create Project:**
   - Create new knitting project
   - Add project details
   - Upload project photo

4. **Offline Mode:**
   - Disconnect network
   - Verify app still works
   - Make changes offline
   - Reconnect and verify sync

5. **WebSocket:**
   - Open project in two browser tabs
   - Make change in one tab
   - Verify real-time update in other tab

---

## 🔧 Configuration Files Reference

### Nginx Configuration
- Main config: `/etc/nginx/sites-available/rowlyknit`
- Global config: `deployment/nginx/nginx.conf`
- Site config: `deployment/nginx/conf.d/rowlyknit.conf`

### PM2 Configuration
- Ecosystem file: `ecosystem.config.js`
- Process list: `sudo -u rowly pm2 list`
- Startup script: `/etc/systemd/system/pm2-rowly.service`

### SSL Certificates
- Certificates: `/etc/letsencrypt/live/rowlyknit.com/`
- Auto-renewal: `/etc/cron.d/certbot`

### Backup Configuration
- Backup directory: `/backups`
- Backup scripts: `/usr/local/bin/rowly-backup-*.sh`
- Cron jobs: `sudo -u rowly crontab -l`

---

## 📊 Monitoring & Analytics

### Prometheus Metrics

Access metrics at: `http://localhost:5000/metrics` (internal only)

Available metrics:
- `http_request_duration_seconds` - Request latency
- `http_requests_total` - Total requests
- `http_requests_in_progress` - Active requests
- `database_query_duration_seconds` - Database performance
- `cache_operations_total` - Cache hit/miss rates
- `errors_total` - Error counts by type

### Application Logs

```bash
# PM2 logs
sudo -u rowly pm2 logs rowly-backend

# Application log file
sudo tail -f /home/rowly/rowlyknit/backend/logs/app.log

# Nginx access log
sudo tail -f /var/log/nginx/rowlyknit.com.access.log

# Nginx error log
sudo tail -f /var/log/nginx/rowlyknit.com.error.log
```

### Error Tracking (Optional)

Setup Sentry for error tracking:

1. Create Sentry account at https://sentry.io
2. Create new project for Node.js
3. Get DSN from project settings
4. Add to backend `.env`:
   ```env
   SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
   SENTRY_ENVIRONMENT=production
   ```
5. Restart application

---

## 🔄 Update Deployment

For subsequent deployments:

```bash
cd /home/user/rowlyknit/deployment/scripts
sudo bash deploy-production.sh update
```

This will:
1. Create pre-deployment backup
2. Pull latest code
3. Update dependencies
4. Build application
5. Run migrations
6. Restart services
7. Verify health

---

## 🛠️ Maintenance Commands

### Application Management

```bash
# View status
sudo -u rowly pm2 status

# Restart application
sudo -u rowly pm2 restart rowly-backend

# Stop application
sudo -u rowly pm2 stop rowly-backend

# View logs
sudo -u rowly pm2 logs rowly-backend

# Monitor resources
sudo -u rowly pm2 monit
```

### Database Management

```bash
# Connect to database
sudo -u postgres psql rowly_production

# Vacuum database
sudo -u postgres vacuumdb rowly_production --analyze

# Check database size
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('rowly_production'));"

# Manual backup
sudo -u rowly /usr/local/bin/rowly-backup-db.sh
```

### Nginx Management

```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# View access logs
sudo tail -f /var/log/nginx/access.log
```

### SSL Certificate Renewal

```bash
# Manual renewal
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run

# View certificates
sudo certbot certificates
```

### Backup Management

```bash
# Manual database backup
sudo -u rowly /usr/local/bin/rowly-backup-db.sh

# Manual file backup
sudo -u rowly /usr/local/bin/rowly-backup-files.sh

# Full backup
sudo -u rowly /usr/local/bin/rowly-backup-all.sh

# List backups
ls -lh /backups/

# Restore database
sudo -u rowly /usr/local/bin/rowly-restore.sh /backups/rowly_db_YYYYMMDD_HHMMSS.sql.gz
```

---

## 🐛 Troubleshooting

### Application Won't Start

```bash
# Check logs
sudo -u rowly pm2 logs rowly-backend --err

# Check environment variables
cat /home/rowly/rowlyknit/backend/.env

# Check Node.js version
node --version  # Should be v18.x

# Rebuild application
cd /home/rowly/rowlyknit/backend
sudo -u rowly npm run build
```

### Database Connection Errors

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
sudo -u postgres psql rowly_production -c "SELECT 1;"

# Check pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Nginx Errors

```bash
# Check configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Check if ports are in use
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# Restart Nginx
sudo systemctl restart nginx
```

### SSL Certificate Issues

```bash
# Check certificate expiry
sudo certbot certificates

# Renew certificates
sudo certbot renew --force-renewal

# Check Nginx SSL config
sudo nano /etc/nginx/sites-available/rowlyknit
```

### Email Not Sending

```bash
# Check email logs
sudo tail -f /home/rowly/rowlyknit/backend/logs/app.log | grep -i email

# Test SMTP connection (SendGrid example)
telnet smtp.sendgrid.net 587

# Verify DNS records
dig rowlyknit.com TXT | grep spf
dig s1._domainkey.rowlyknit.com TXT
```

---

## 📞 Support & Resources

### Documentation
- Rowly Docs: `/home/user/rowlyknit/docs/`
- Nginx Docs: https://nginx.org/en/docs/
- PM2 Docs: https://pm2.keymetrics.io/docs/
- Let's Encrypt: https://letsencrypt.org/docs/

### Monitoring URLs
- Frontend: https://rowlyknit.com
- API Health: https://api.rowlyknit.com/health
- API Docs: https://api.rowlyknit.com/api
- Metrics: http://localhost:5000/metrics (internal)

### Important Files
- Backend env: `/home/rowly/rowlyknit/backend/.env`
- Frontend env: `/home/rowly/rowlyknit/frontend/.env.production`
- Nginx config: `/etc/nginx/sites-available/rowlyknit`
- PM2 config: `/home/rowly/rowlyknit/ecosystem.config.js`
- Backup logs: `/var/log/rowly-backup.log`

---

## ✨ Production Deployment Checklist

Use this checklist to verify your deployment:

### Infrastructure
- [ ] Digital Ocean droplet running Ubuntu 22.04
- [ ] SSH access configured
- [ ] Firewall configured (ports 22, 80, 443)
- [ ] DNS configured and propagated

### Application
- [ ] Code deployed from correct branch
- [ ] Environment variables configured
- [ ] Dependencies installed
- [ ] Application built successfully
- [ ] Database migrations completed
- [ ] PM2 running application

### Security
- [ ] SSL/TLS certificates installed
- [ ] HTTPS redirect working
- [ ] HSTS headers configured
- [ ] Rate limiting active
- [ ] CSRF protection enabled
- [ ] Helmet security headers applied
- [ ] Input sanitization working
- [ ] Firewall configured

### Monitoring
- [ ] Prometheus metrics accessible
- [ ] PM2 monitoring active
- [ ] Log rotation configured
- [ ] Error tracking setup (if using Sentry)

### Email
- [ ] Email service configured
- [ ] SPF record added
- [ ] DKIM record added
- [ ] DMARC record added
- [ ] Sender domain verified
- [ ] Welcome email working
- [ ] Password reset email working

### Backups
- [ ] Backup directory created
- [ ] Database backup script working
- [ ] File backup script working
- [ ] Cron jobs configured
- [ ] Backup retention policy set
- [ ] Backup restoration tested

### Performance
- [ ] Gzip compression enabled
- [ ] Static assets cached
- [ ] CDN configured (Cloudflare)
- [ ] Database query optimization
- [ ] Redis caching working

### Functionality
- [ ] User registration working
- [ ] Email verification working
- [ ] User login working
- [ ] Project creation working
- [ ] File uploads working
- [ ] WebSocket connections working
- [ ] Offline mode working
- [ ] Mobile responsiveness verified

---

**Deployment Complete!** 🎉

Your Rowly application is now running in production with enterprise-grade security, monitoring, and reliability.

Made with ❤️ and 🧶 for knitters, by knitters.
