# Database Setup Guide

Quick start guide for setting up the experience cards database.

## Prerequisites

- PostgreSQL 14+ installed locally or access to hosted Postgres (Railway, Supabase, etc.)
- Node.js 20+
- npm or yarn

## Installation

### 1. Install Dependencies

```bash
npm install
```

This installs:
- `pg` - PostgreSQL client for Node.js
- `@anthropic-ai/sdk` - For content generation pipeline

### 2. Create Database

**Local PostgreSQL:**

```bash
# Create database
createdb exp_travel

# Or using psql
psql -c "CREATE DATABASE exp_travel;"
```

**Hosted (Railway, Supabase, etc.):**

Create database through provider's dashboard and copy connection string.

### 3. Set Environment Variable

Create `.env` file in project root:

```bash
# Local development
DATABASE_URL="postgresql://localhost:5432/exp_travel"

# Or hosted (example)
DATABASE_URL="postgresql://user:password@host:5432/exp_travel"
```

**Important:** Add `.env` to `.gitignore` to keep credentials out of version control.

### 4. Run Migrations

```bash
npm run db:migrate
```

This creates:
- `cards` table
- Helper views (`experience_cards`, `list_cards`)
- Indexes for performance
- Triggers for `updated_at` automation

Verify:

```bash
npm run db:migrate:status
```

Should show:
```
✅ 001_initial.sql
```

## Testing the Setup

### Quick Test

```bash
npm run db:test
```

This runs a full test suite:
1. Creates 3 experience-cards
2. Creates 1 list-card
3. Tests list membership operations
4. Tests status updates
5. Tests querying

Expected output:
```
✅ All tests passed!

📋 Summary:
  - Created 3 experience-cards
  - Created 1 list-card
  - Tested list membership operations
  - Tested status updates
  - Tested querying by status
```

### Clean Test Data

```bash
npm run db:test:clean
```

Removes all cards with `generated_by = 'manual-test'`.

## Importing Data

### From JSON File

```bash
# Dry run (preview without importing)
npm run db:seed data/04-enriched/italy-50.json -- --dry-run

# Import for real
npm run db:seed data/04-enriched/italy-50.json

# Import allowing duplicates
npm run db:seed italian-experiences.json -- --allow-duplicates
```

The seed script handles multiple JSON formats:

**Pass 4 output format:**
```json
{
  "headline": "...",
  "subhead": "...",
  "full_entry": "...",
  "where": "Alba, Piedmont, Italy",
  "when": "October–November, mornings",
  "source": "...",
  "themes": ["morning_rituals"],
  "pass4_model": "claude-sonnet-4-6"
}
```

**Simplified format:**
```json
{
  "headline": "...",
  "where_country": "italy",
  "where_city": "Alba",
  "status": "draft",
  "themes": ["morning_rituals"]
}
```

The seed script normalizes both formats to the database schema.

## Manual Database Operations

### Using psql

```bash
# Connect to database
psql $DATABASE_URL

# List tables
\dt

# Query cards
SELECT id, headline, status FROM cards LIMIT 10;

# Check experience-cards
SELECT * FROM experience_cards WHERE where_country = 'italy';

# Check list-cards
SELECT * FROM list_cards;

# Exit
\q
```

### Using Node.js REPL

```bash
node --experimental-repl-await
```

```javascript
import { CardsService } from './lib/cards.js';

// Get all published cards
const published = await CardsService.getCardsByStatus('published');

// Get a specific card
const card = await CardsService.getCard('uuid-here');

// Find lists containing a card
const lists = await CardsService.getListsContainingCard('uuid-here');
```

## Common Tasks

### Check Database Status

```bash
# Migration status
npm run db:migrate:status

# Table sizes
psql $DATABASE_URL -c "
  SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size('cards')) as size
  FROM pg_tables
  WHERE schemaname = 'public';
"

# Card counts by status
psql $DATABASE_URL -c "
  SELECT status, COUNT(*) as count
  FROM cards
  GROUP BY status
  ORDER BY count DESC;
"
```

### Backup Database

```bash
# Manual backup
./database/backup.sh

# Or using pg_dump directly
pg_dump $DATABASE_URL > backups/manual_backup_$(date +%Y%m%d).sql
gzip backups/manual_backup_*.sql
```

### Restore from Backup

```bash
# Restore from compressed backup
gunzip -c backups/exp_travel_20260504_030000.sql.gz | psql $DATABASE_URL
```

## Production Deployment

### 1. Environment Setup

Set `DATABASE_URL` in production environment:

```bash
# Railway
railway variables set DATABASE_URL="postgresql://..."

# Vercel
vercel env add DATABASE_URL production

# Or in platform dashboard
```

### 2. Run Migrations

```bash
# On production server or via CI/CD
npm run db:migrate
```

### 3. Setup Automated Backups

**Using cron (Linux/Mac):**

```bash
# Edit crontab
crontab -e

# Add daily backup at 3am
0 3 * * * cd /path/to/exp && ./database/backup.sh >> /var/log/exp_backup.log 2>&1
```

**Using GitHub Actions (example):**

```yaml
# .github/workflows/backup.yml
name: Daily Backup
on:
  schedule:
    - cron: '0 3 * * *'
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: ./database/backup.sh
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      - uses: aws-actions/configure-aws-credentials@v1
      - run: aws s3 sync backups/ s3://your-bucket/backups/
```

### 4. Monitor Performance

```sql
-- Slow queries (requires pg_stat_statements extension)
SELECT
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan;
```

## Troubleshooting

### Connection Refused

```bash
# Check if PostgreSQL is running
pg_isready

# Check DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://[user[:password]@][host][:port]/database
```

### Migration Fails

```bash
# Check migration status
npm run db:migrate:status

# If stuck, manually check
psql $DATABASE_URL -c "SELECT * FROM schema_migrations;"

# Reset (CAUTION: deletes all data)
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run db:migrate
```

### Import Errors

```bash
# Validate JSON syntax
node -e "console.log(JSON.parse(require('fs').readFileSync('file.json')))"

# Dry run to see what would be imported
npm run db:seed file.json -- --dry-run
```

### Performance Issues

```bash
# Vacuum and analyze
psql $DATABASE_URL -c "VACUUM ANALYZE cards;"

# Rebuild indexes
psql $DATABASE_URL -c "REINDEX TABLE cards;"

# Check table bloat
psql $DATABASE_URL -c "
  SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

## Next Steps

1. **Import your first batch of cards:**
   ```bash
   npm run db:seed data/04-enriched/your-file.json
   ```

2. **Create your first list-card manually:**
   ```javascript
   const list = await CardsService.createCard({
     headline: 'My First List',
     member_card_ids: ['card-id-1', 'card-id-2'],
     curator_notes: 'A curated collection',
     themes: ['morning_rituals'],
     status: 'draft'
   });
   ```

3. **Build your API layer** (see main project README)

4. **Setup automated backups** in production

## Support

- Full documentation: `database/README.md`
- Schema reference: `database/schema.sql`
- Data access API: `lib/cards.js`
- Project README: `README.md`
