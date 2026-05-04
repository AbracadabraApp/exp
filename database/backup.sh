#!/bin/bash
# database/backup.sh - Automated PostgreSQL backup script
# Schedule with cron for daily backups

set -e

# Configuration
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/exp_travel_$DATE.sql"
RETENTION_DAYS=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ Error: DATABASE_URL environment variable not set${NC}"
  exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting database backup..."
echo "  Date: $(date)"
echo "  Backup file: $BACKUP_FILE"

# Dump database
if pg_dump "$DATABASE_URL" > "$BACKUP_FILE"; then
  echo -e "${GREEN}✅ Database dump completed${NC}"
else
  echo -e "${RED}❌ Database dump failed${NC}"
  exit 1
fi

# Compress backup
if gzip "$BACKUP_FILE"; then
  echo -e "${GREEN}✅ Backup compressed: $BACKUP_FILE.gz${NC}"
  BACKUP_FILE="$BACKUP_FILE.gz"
else
  echo -e "${YELLOW}⚠️  Compression failed, keeping uncompressed backup${NC}"
fi

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "  Size: $BACKUP_SIZE"

# Clean old backups
echo ""
echo "🧹 Cleaning old backups (keeping last $RETENTION_DAYS days)..."
DELETED=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
echo -e "${GREEN}✅ Deleted $DELETED old backup(s)${NC}"

# List recent backups
echo ""
echo "📋 Recent backups:"
ls -lht "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -5 | while read line; do
  echo "  $line"
done

echo ""
echo -e "${GREEN}✅ Backup complete: $BACKUP_FILE${NC}"

# Optional: Upload to cloud storage (uncomment and configure)
# echo "☁️  Uploading to cloud storage..."
# aws s3 cp "$BACKUP_FILE" "s3://your-bucket/backups/" || echo "⚠️  Cloud upload failed"
