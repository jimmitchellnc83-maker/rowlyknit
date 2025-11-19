#!/bin/bash

# Rowly Database and File Backup Automation Script
# This script sets up automated backups for PostgreSQL database and uploaded files

set -e

echo "🔧 Setting up automated backups for Rowly..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
BACKUP_DIR="/backups"
BACKUP_USER="rowly"
DB_NAME="${DB_NAME:-rowly_production}"
DB_USER="${DB_USER:-rowly_user}"
APP_DIR="/home/rowly/rowlyknit"

# Create backup directory
echo -e "${YELLOW}📁 Creating backup directory...${NC}"
mkdir -p $BACKUP_DIR
chown $BACKUP_USER:$BACKUP_USER $BACKUP_DIR
chmod 750 $BACKUP_DIR

# Create database backup script
echo -e "${YELLOW}📝 Creating database backup script...${NC}"
cat > /usr/local/bin/rowly-backup-db.sh << 'EOF'
#!/bin/bash

# Database backup script
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="rowly_production"
DB_USER="rowly_user"
RETENTION_DAYS=30

# Create backup
echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting database backup..."

PGPASSWORD="${DB_PASSWORD}" pg_dump -h localhost -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/rowly_db_$DATE.sql.gz

if [ $? -eq 0 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Database backup completed: rowly_db_$DATE.sql.gz"

    # Calculate size
    SIZE=$(du -h $BACKUP_DIR/rowly_db_$DATE.sql.gz | cut -f1)
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Backup size: $SIZE"
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ERROR: Database backup failed!"
    exit 1
fi

# Remove old backups
echo "$(date '+%Y-%m-%d %H:%M:%S') - Cleaning up old backups (older than $RETENTION_DAYS days)..."
find $BACKUP_DIR -name "rowly_db_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Count remaining backups
BACKUP_COUNT=$(find $BACKUP_DIR -name "rowly_db_*.sql.gz" | wc -l)
echo "$(date '+%Y-%m-%d %H:%M:%S') - Total database backups: $BACKUP_COUNT"

EOF

chmod +x /usr/local/bin/rowly-backup-db.sh
chown $BACKUP_USER:$BACKUP_USER /usr/local/bin/rowly-backup-db.sh

# Create file backup script
echo -e "${YELLOW}📝 Creating file backup script...${NC}"
cat > /usr/local/bin/rowly-backup-files.sh << 'EOF'
#!/bin/bash

# File backup script
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/home/rowly/rowlyknit"
UPLOAD_DIR="$APP_DIR/backend/uploads"
RETENTION_DAYS=30

# Create backup
echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting file backup..."

if [ ! -d "$UPLOAD_DIR" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ERROR: Upload directory not found: $UPLOAD_DIR"
    exit 1
fi

tar -czf $BACKUP_DIR/rowly_files_$DATE.tar.gz -C $APP_DIR/backend uploads

if [ $? -eq 0 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - File backup completed: rowly_files_$DATE.tar.gz"

    # Calculate size
    SIZE=$(du -h $BACKUP_DIR/rowly_files_$DATE.tar.gz | cut -f1)
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Backup size: $SIZE"
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ERROR: File backup failed!"
    exit 1
fi

# Remove old backups
echo "$(date '+%Y-%m-%d %H:%M:%S') - Cleaning up old backups (older than $RETENTION_DAYS days)..."
find $BACKUP_DIR -name "rowly_files_*.tar.gz" -mtime +$RETENTION_DAYS -delete

# Count remaining backups
BACKUP_COUNT=$(find $BACKUP_DIR -name "rowly_files_*.tar.gz" | wc -l)
echo "$(date '+%Y-%m-%d %H:%M:%S') - Total file backups: $BACKUP_COUNT"

EOF

chmod +x /usr/local/bin/rowly-backup-files.sh
chown $BACKUP_USER:$BACKUP_USER /usr/local/bin/rowly-backup-files.sh

# Create combined backup script
echo -e "${YELLOW}📝 Creating combined backup script...${NC}"
cat > /usr/local/bin/rowly-backup-all.sh << 'EOF'
#!/bin/bash

# Combined backup script
echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting complete backup..."

# Run database backup
/usr/local/bin/rowly-backup-db.sh

# Run file backup
/usr/local/bin/rowly-backup-files.sh

echo "$(date '+%Y-%m-%d %H:%M:%S') - Complete backup finished"

EOF

chmod +x /usr/local/bin/rowly-backup-all.sh
chown $BACKUP_USER:$BACKUP_USER /usr/local/bin/rowly-backup-all.sh

# Create restore script
echo -e "${YELLOW}📝 Creating restore script...${NC}"
cat > /usr/local/bin/rowly-restore.sh << 'EOF'
#!/bin/bash

# Restore script
set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh /backups/rowly_* | tail -10
    exit 1
fi

BACKUP_FILE=$1
DB_NAME="rowly_production"
DB_USER="rowly_user"

if [[ $BACKUP_FILE == *.sql.gz ]]; then
    echo "Restoring database from $BACKUP_FILE..."
    read -p "This will overwrite the current database. Are you sure? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled"
        exit 0
    fi

    # Stop application
    pm2 stop rowly-backend

    # Restore database
    gunzip -c $BACKUP_FILE | PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U $DB_USER $DB_NAME

    # Start application
    pm2 start rowly-backend

    echo "Database restored successfully"

elif [[ $BACKUP_FILE == *.tar.gz ]]; then
    echo "Restoring files from $BACKUP_FILE..."
    read -p "This will overwrite current uploaded files. Are you sure? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled"
        exit 0
    fi

    tar -xzf $BACKUP_FILE -C /home/rowly/rowlyknit/backend

    echo "Files restored successfully"
else
    echo "Error: Unknown backup file type"
    exit 1
fi

EOF

chmod +x /usr/local/bin/rowly-restore.sh
chown $BACKUP_USER:$BACKUP_USER /usr/local/bin/rowly-restore.sh

# Setup cron jobs
echo -e "${YELLOW}⏰ Setting up cron jobs...${NC}"

# Create cron file for rowly user
cat > /tmp/rowly-cron << EOF
# Rowly Automated Backups
# Database backup - Daily at 2:00 AM
0 2 * * * /usr/local/bin/rowly-backup-db.sh >> /var/log/rowly-backup.log 2>&1

# File backup - Daily at 3:00 AM
0 3 * * * /usr/local/bin/rowly-backup-files.sh >> /var/log/rowly-backup.log 2>&1

# Weekly full backup - Sunday at 4:00 AM
0 4 * * 0 /usr/local/bin/rowly-backup-all.sh >> /var/log/rowly-backup.log 2>&1
EOF

# Install cron jobs for rowly user
sudo -u $BACKUP_USER crontab /tmp/rowly-cron
rm /tmp/rowly-cron

# Create log file
touch /var/log/rowly-backup.log
chown $BACKUP_USER:$BACKUP_USER /var/log/rowly-backup.log
chmod 644 /var/log/rowly-backup.log

# Setup logrotate for backup logs
echo -e "${YELLOW}📋 Setting up log rotation...${NC}"
cat > /etc/logrotate.d/rowly-backup << EOF
/var/log/rowly-backup.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 $BACKUP_USER $BACKUP_USER
}
EOF

# Test database backup (optional)
echo -e "${YELLOW}🧪 Would you like to run a test backup now? (yes/no)${NC}"
read -p "> " run_test

if [ "$run_test" = "yes" ]; then
    echo -e "${YELLOW}Running test backup...${NC}"
    sudo -u $BACKUP_USER /usr/local/bin/rowly-backup-all.sh

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Test backup completed successfully!${NC}"
        echo ""
        echo "Backup files created:"
        ls -lh $BACKUP_DIR/rowly_* | tail -5
    else
        echo -e "${RED}❌ Test backup failed!${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}✅ Backup automation setup complete!${NC}"
echo ""
echo "Backup schedule:"
echo "  - Daily database backup: 2:00 AM"
echo "  - Daily file backup: 3:00 AM"
echo "  - Weekly full backup: Sunday 4:00 AM"
echo ""
echo "Backup location: $BACKUP_DIR"
echo "Backup retention: 30 days"
echo ""
echo "Manual commands:"
echo "  - Database backup: sudo -u $BACKUP_USER /usr/local/bin/rowly-backup-db.sh"
echo "  - File backup: sudo -u $BACKUP_USER /usr/local/bin/rowly-backup-files.sh"
echo "  - Full backup: sudo -u $BACKUP_USER /usr/local/bin/rowly-backup-all.sh"
echo "  - Restore: sudo -u $BACKUP_USER /usr/local/bin/rowly-restore.sh <backup_file>"
echo "  - View logs: tail -f /var/log/rowly-backup.log"
echo ""
