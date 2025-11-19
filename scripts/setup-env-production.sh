#!/bin/bash

# Script to generate production environment files with secure passwords
# Run this on the production server

set -e

echo "🔐 Generating Production Environment Files..."
echo "=============================================="

# Generate secure random passwords
DB_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)
SESSION_SECRET=$(openssl rand -base64 32)

# Create root .env file for docker-compose
cat > .env << EOF
# Docker Compose Environment Variables
# Root configuration for all services

# Database Configuration
DB_NAME=rowly_production
DB_USER=rowly_user
DB_PASSWORD=${DB_PASSWORD}

# Redis Configuration
REDIS_PASSWORD=${REDIS_PASSWORD}

# Frontend Build Args
VITE_API_URL=https://rowlyknit.com
EOF

echo "✅ Created root .env file"

# Create backend .env file
cat > backend/.env << EOF
# Rowly Production Environment Configuration

# ============================================
# SERVER CONFIGURATION
# ============================================
NODE_ENV=production
PORT=5000
API_VERSION=v1

# URLs
API_URL=https://rowlyknit.com
FRONTEND_URL=https://rowlyknit.com
ALLOWED_ORIGINS=https://rowlyknit.com,https://www.rowlyknit.com,http://rowlyknit.com

# ============================================
# DATABASE CONFIGURATION
# ============================================
DB_HOST=postgres
DB_PORT=5432
DB_NAME=rowly_production
DB_USER=rowly_user
DB_PASSWORD=${DB_PASSWORD}

# Database Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=10

# ============================================
# REDIS CONFIGURATION
# ============================================
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_DB=0

# ============================================
# SECURITY
# ============================================

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Session Configuration
SESSION_SECRET=${SESSION_SECRET}
SESSION_COOKIE_MAX_AGE=604800000
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTP_ONLY=true
SESSION_COOKIE_SAME_SITE=strict

# CSRF Configuration
CSRF_COOKIE_SECURE=true

# ============================================
# RATE LIMITING
# ============================================
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5
UPLOAD_RATE_LIMIT_MAX=20

# ============================================
# FILE UPLOAD
# ============================================
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=52428800
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp,application/pdf

# ============================================
# EMAIL CONFIGURATION (Optional - configure when needed)
# ============================================
EMAIL_PROVIDER=sendgrid
EMAIL_FROM=noreply@rowlyknit.com
EMAIL_FROM_NAME=Rowly Knitting App
EMAIL_REPLY_TO=support@rowlyknit.com

# ============================================
# LOGGING
# ============================================
LOG_LEVEL=info
LOG_FILE=/var/log/rowly/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=14

# ============================================
# CORS
# ============================================
CORS_ORIGIN=https://rowlyknit.com

# ============================================
# SSL/SECURITY
# ============================================
TRUST_PROXY=true
FORCE_HTTPS=false

# Security Headers
HELMET_HSTS_MAX_AGE=31536000
HELMET_HSTS_INCLUDE_SUBDOMAINS=true
HELMET_HSTS_PRELOAD=true

# ============================================
# MONITORING & ANALYTICS
# ============================================
SENTRY_ENVIRONMENT=production

# ============================================
# BACKUP CONFIGURATION
# ============================================
BACKUP_DIR=/backups
BACKUP_RETENTION_DAYS=30

# ============================================
# FEATURE FLAGS
# ============================================
ENABLE_SWAGGER=false
ENABLE_METRICS=true
ENABLE_SOCKET_IO=true

# ============================================
# GDPR & COMPLIANCE
# ============================================
DATA_RETENTION_DAYS=365
ENABLE_GDPR_MODE=true

# ============================================
# PERFORMANCE
# ============================================
COMPRESSION_LEVEL=6
CACHE_TTL=3600

# ============================================
# DEVELOPMENT/DEBUG
# ============================================
DEBUG=false
VERBOSE_LOGGING=false
EOF

echo "✅ Created backend/.env file"

# Set secure file permissions
chmod 600 .env
chmod 600 backend/.env

echo ""
echo "🎉 Environment files created successfully!"
echo ""
echo "📝 Generated secure passwords for:"
echo "   - PostgreSQL database"
echo "   - Redis cache"
echo "   - JWT authentication"
echo "   - Session management"
echo ""
echo "⚠️  IMPORTANT: These files contain sensitive credentials."
echo "    Never commit them to version control."
echo ""
echo "✅ You can now run: ./scripts/deploy-production.sh"
echo ""
