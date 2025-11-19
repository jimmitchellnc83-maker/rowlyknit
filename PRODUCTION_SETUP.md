# Rowly Production Setup Guide

## Current Status
✓ Repository cloned and on correct branch
✓ SSL certificates already obtained
✓ Deployment scripts exist

## Next Steps

### 1. Complete SSL Setup (In Progress)

You're currently being asked about the SSL certificate. **Select option 1** to keep the existing certificate:

```bash
Select the appropriate number [1-2] then [enter] (press 'c' to cancel): 1
```

### 2. Configure Environment Files

#### Backend Environment

```bash
cd /home/user/rowlyknit/backend
cp .env.production.example .env
nano .env
```

**Required changes in `.env`:**
- `DB_PASSWORD` - Strong database password
- `REDIS_PASSWORD` - Strong Redis password
- `JWT_SECRET` - 32+ character random string (generate with: `openssl rand -base64 32`)
- `SESSION_SECRET` - Another random string
- `EMAIL_API_KEY` or `SENDGRID_API_KEY` - If using email features

**Optional:**
- `SENTRY_DSN` - For error tracking
- `GOOGLE_ANALYTICS_ID` - For analytics

#### Frontend Environment

```bash
cd /home/user/rowlyknit/frontend
cp .env.production.example .env.production
nano .env.production
```

The defaults should work, but verify:
- `VITE_API_URL=https://api.rowlyknit.com`
- `VITE_WS_URL=wss://api.rowlyknit.com`
- `VITE_APP_URL=https://rowlyknit.com`

### 3. Set Up Database and Redis

If not already done:

```bash
# PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Redis
sudo systemctl start redis
sudo systemctl enable redis
```

Create the database (replace YOUR_PASSWORD with your DB_PASSWORD from .env):

```bash
sudo -u postgres psql << 'EOF'
CREATE DATABASE rowly_production;
CREATE USER rowly_user WITH ENCRYPTED PASSWORD 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE rowly_production TO rowly_user;
ALTER DATABASE rowly_production OWNER TO rowly_user;
\c rowly_production
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOF
```

Configure Redis password:

```bash
sudo sed -i "s/# requirepass .*/requirepass YOUR_REDIS_PASSWORD/" /etc/redis/redis.conf
sudo systemctl restart redis
```

### 4. Run Deployment

Now you can run the full deployment:

```bash
cd /home/user/rowlyknit/deployment/scripts
sudo bash deploy-production.sh initial
```

Or if you've already done initial setup and just need to update:

```bash
sudo bash deploy-production.sh update
```

### 5. Quick Commands Reference

#### Generate Secrets
```bash
# JWT Secret
openssl rand -base64 32

# Session Secret
openssl rand -base64 32
```

#### Check Services
```bash
# PM2 status
pm2 status

# PM2 logs
pm2 logs

# Nginx status
systemctl status nginx

# Database status
systemctl status postgresql

# Redis status
systemctl status redis
```

#### Application Management
```bash
# Restart application
pm2 restart all

# View logs
pm2 logs rowly-backend
pm2 logs rowly-frontend

# Reload Nginx
systemctl reload nginx
```

#### Test Health
```bash
# Backend health
curl http://localhost:5000/health

# Frontend
curl http://localhost

# Public HTTPS endpoints
curl https://api.rowlyknit.com/health
curl https://rowlyknit.com
```

## Troubleshooting

### Can't find .env.production.example
Make sure you're in the correct directory:
```bash
cd /home/user/rowlyknit/backend  # for backend
cd /home/user/rowlyknit/frontend # for frontend
```

### Database connection errors
- Check PostgreSQL is running: `systemctl status postgresql`
- Verify credentials in `.env` match database user
- Check connection: `psql -U rowly_user -d rowly_production -h localhost`

### Build errors
- Check Node.js version: `node --version` (should be 18.x)
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check logs: `npm run build`

### PM2 not starting
- Check logs: `pm2 logs`
- Verify ecosystem.config.js exists
- Restart: `pm2 restart all`

## Security Checklist

- [ ] Strong database password set
- [ ] Strong Redis password set
- [ ] JWT_SECRET is random and secure (32+ chars)
- [ ] SESSION_SECRET is random and secure
- [ ] Firewall configured (UFW)
- [ ] SSH key-based auth (disable password auth)
- [ ] SSL certificates installed and auto-renewal configured
- [ ] Regular backups configured
- [ ] Monitoring set up (PM2, logs)

## Post-Deployment

After successful deployment:

1. **Test all endpoints:**
   - https://rowlyknit.com
   - https://api.rowlyknit.com/health
   - https://www.rowlyknit.com

2. **Set up monitoring:**
   - Configure error tracking (Sentry)
   - Set up analytics (Google Analytics or Plausible)
   - Monitor PM2 logs

3. **Configure backups:**
   ```bash
   sudo bash /home/user/rowlyknit/deployment/scripts/setup-backups.sh
   ```

4. **Test features:**
   - User registration
   - Login
   - Project creation
   - Photo upload
   - Offline mode (PWA)

## Support

For issues or questions:
- Check logs: `pm2 logs`
- Review nginx logs: `tail -f /var/log/nginx/error.log`
- Database logs: `sudo -u postgres tail -f /var/log/postgresql/postgresql-*.log`
