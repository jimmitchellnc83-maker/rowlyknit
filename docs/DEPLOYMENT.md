# Rowly Deployment Guide

This guide provides step-by-step instructions for deploying Rowly to production on Digital Ocean.

## Prerequisites

- Digital Ocean Droplet (Ubuntu 25.10)
- Domain name (rowlyknit.com) configured with Cloudflare
- SSH access to the server
- GitHub repository access

## Server Specifications

- **Server IP**: 165.227.97.4
- **Domain**: rowlyknit.com
- **OS**: Ubuntu 25.10
- **RAM**: 2GB minimum (4GB recommended)
- **Storage**: 50GB minimum

## Initial Server Setup

### 1. Connect to Server

```bash
ssh root@165.227.97.4
```

### 2. Clone Repository

```bash
cd /home/user
git clone https://github.com/jimmitchellnc83-maker/rowlyknit.git
cd rowlyknit
```

### 3. Run Server Setup Script

This script installs Docker, configures firewall, sets up security, and prepares the server.

```bash
cd deployment/scripts
chmod +x server-setup.sh
./server-setup.sh
```

The script will:
- Update system packages
- Install Docker and Docker Compose
- Configure UFW firewall
- Set up fail2ban
- Enable automatic security updates
- Create application directories
- Install systemd service
- Configure log rotation
- Set up automated backups
- Optimize system settings

### 4. Configure Environment Variables

Create and configure the production .env file:

```bash
cd /home/user/rowlyknit/backend
cp .env.example .env
nano .env
```

**Critical variables to configure:**

```bash
# Application
NODE_ENV=production
APP_URL=https://rowlyknit.com

# Database
DB_PASSWORD=<STRONG_PASSWORD_HERE>
DB_USER=rowly_user
DB_NAME=rowly_production

# Redis
REDIS_PASSWORD=<STRONG_PASSWORD_HERE>

# JWT & Authentication
JWT_SECRET=<RANDOM_32_CHARACTER_STRING>
JWT_REFRESH_SECRET=<RANDOM_32_CHARACTER_STRING>
CSRF_SECRET=<RANDOM_32_CHARACTER_STRING>
SESSION_SECRET=<RANDOM_32_CHARACTER_STRING>

# Email
EMAIL_API_KEY=<YOUR_SENDGRID_API_KEY>
EMAIL_FROM=noreply@rowlyknit.com
EMAIL_REPLY_TO=support@rowlyknit.com
```

**Generate strong secrets:**

```bash
# Generate random 32-character strings
openssl rand -base64 32
```

### 5. Set Up SSL/TLS Certificates

Install Let's Encrypt SSL certificates:

```bash
cd /home/user/rowlyknit/deployment/scripts
chmod +x setup-ssl.sh
./setup-ssl.sh
```

This will:
- Install certbot
- Obtain SSL certificates from Let's Encrypt
- Configure automatic renewal
- Set up monthly cron job for renewal

### 6. Deploy Application

Run the deployment script:

```bash
cd /home/user/rowlyknit/deployment/scripts
chmod +x deploy.sh
./deploy.sh
```

The deployment script will:
- Pull latest code
- Create database backup
- Stop existing containers
- Pull Docker images
- Build application images
- Run database migrations
- Start all containers
- Verify health checks
- Clean up old images and backups

### 7. Enable Systemd Service

Enable automatic startup on boot:

```bash
systemctl daemon-reload
systemctl enable rowly
systemctl start rowly
systemctl status rowly
```

## Cloudflare Configuration

### DNS Settings

Ensure these DNS records are configured in Cloudflare:

| Type | Name | Content | Proxy Status |
|------|------|---------|--------------|
| A | @ | 165.227.97.4 | Proxied |
| A | www | 165.227.97.4 | Proxied |
| CNAME | mail | rowlyknit.com | DNS only |

### SSL/TLS Settings

- **SSL/TLS encryption mode**: Full (strict)
- **Always Use HTTPS**: On
- **Automatic HTTPS Rewrites**: On
- **Minimum TLS Version**: 1.2
- **TLS 1.3**: On

### Security Settings

- **Security Level**: Medium
- **Challenge Passage**: 30 minutes
- **Browser Integrity Check**: On
- **Email Obfuscation**: On

### Speed Optimization

- **Auto Minify**: Enable CSS, JS, HTML
- **Brotli**: On
- **Rocket Loader**: Off (for React compatibility)
- **Mirage**: On
- **Polish**: Lossless

## Email Configuration (SendGrid)

### 1. Create SendGrid Account

1. Sign up at https://sendgrid.com
2. Create API key with "Mail Send" permissions
3. Add API key to .env file

### 2. Configure DNS Records

Add these records in Cloudflare DNS:

```
CNAME mail.rowlyknit.com -> sendgrid.net
```

### 3. Domain Authentication

1. Go to SendGrid Settings > Sender Authentication
2. Authenticate your domain (rowlyknit.com)
3. Add provided CNAME records to Cloudflare
4. Verify authentication

### 4. SPF/DKIM/DMARC

Add these DNS TXT records:

```
# SPF
TXT @ "v=spf1 include:sendgrid.net ~all"

# DMARC
TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:admin@rowlyknit.com"
```

## Post-Deployment Verification

### 1. Health Checks

```bash
# Backend health
curl https://rowlyknit.com/health

# Check all services
docker-compose ps
```

### 2. View Logs

```bash
# All logs
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
```

### 3. Database Verification

```bash
# Connect to database
docker-compose exec postgres psql -U rowly_user rowly_production

# List tables
\dt

# Check data
SELECT COUNT(*) FROM users;
```

### 4. SSL Certificate Verification

```bash
# Check certificate
certbot certificates

# Test renewal
certbot renew --dry-run
```

## Monitoring

### Application Logs

```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Service-specific
docker-compose logs backend --tail=50
```

### System Resources

```bash
# Docker stats
docker stats

# Disk usage
df -h

# Memory usage
free -h

# Process monitoring
htop
```

### Database Monitoring

```bash
# Connection count
docker-compose exec postgres psql -U rowly_user -d rowly_production -c "SELECT count(*) FROM pg_stat_activity;"

# Database size
docker-compose exec postgres psql -U rowly_user -d rowly_production -c "SELECT pg_size_pretty(pg_database_size('rowly_production'));"
```

## Backup and Restore

### Manual Backup

```bash
# Create backup
docker-compose exec postgres pg_dump -U rowly_user rowly_production > /backups/manual_backup_$(date +%Y%m%d_%H%M%S).sql
gzip /backups/manual_backup_*.sql
```

### Restore from Backup

```bash
# Stop application
docker-compose down

# Restore database
gunzip -c /backups/backup_file.sql.gz | docker-compose exec -T postgres psql -U rowly_user rowly_production

# Start application
docker-compose up -d
```

### Automated Backups

Backups run automatically every hour via cron. Check:

```bash
# List backups
ls -lh /backups/

# Test backup script
/etc/cron.hourly/rowly-backup
```

## Troubleshooting

### Application Won't Start

```bash
# Check Docker status
systemctl status docker

# Restart Docker
systemctl restart docker

# Rebuild containers
docker-compose down
docker-compose up -d --build
```

### Database Connection Errors

```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Verify connection
docker-compose exec postgres psql -U rowly_user -d rowly_production

# Restart database
docker-compose restart postgres
```

### SSL Certificate Issues

```bash
# Check certificate expiry
certbot certificates

# Renew manually
certbot renew

# Restart nginx
docker-compose restart nginx
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Restart specific service
docker-compose restart backend

# Full restart
docker-compose restart
```

## Scaling

### Increase Database Connection Pool

Edit `backend/.env`:

```bash
DB_POOL_MIN=5
DB_POOL_MAX=20
```

Restart backend:

```bash
docker-compose restart backend
```

### Vertical Scaling (Upgrade Droplet)

1. Take snapshot of droplet
2. Resize droplet in Digital Ocean dashboard
3. Reboot server
4. Verify all services running

### Horizontal Scaling (Multiple Servers)

For high traffic, consider:
- Load balancer (Digital Ocean Load Balancer)
- Managed PostgreSQL (Digital Ocean Managed Database)
- Redis cluster
- Multiple application servers

## Security Best Practices

### Regular Updates

```bash
# Update system packages
apt update && apt upgrade -y

# Update Docker images
docker-compose pull
docker-compose up -d

# Check for security updates
npm audit
```

### Firewall Rules

```bash
# Check UFW status
ufw status verbose

# Allow new port if needed
ufw allow 8080/tcp
```

### Fail2ban

```bash
# Check fail2ban status
fail2ban-client status

# Check banned IPs
fail2ban-client status sshd
```

## Rollback Procedure

If deployment fails:

```bash
# View previous commits
git log --oneline

# Rollback to previous version
git checkout <previous-commit-hash>

# Redeploy
./deployment/scripts/deploy.sh

# Or restore from backup
gunzip -c /backups/latest_backup.sql.gz | docker-compose exec -T postgres psql -U rowly_user rowly_production
```

## Performance Optimization

### Enable Caching

Cloudflare caching is already configured. Verify:
- Browser Cache TTL: 4 hours
- Edge Cache TTL: Respect Existing Headers

### Database Indexes

Check query performance:

```sql
-- Slow queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;

-- Missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
```

### Redis Performance

```bash
# Redis info
docker-compose exec redis redis-cli INFO

# Monitor Redis
docker-compose exec redis redis-cli MONITOR
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/jimmitchellnc83-maker/rowlyknit/issues
- Email: support@rowlyknit.com
- Documentation: https://github.com/jimmitchellnc83-maker/rowlyknit/tree/main/docs
