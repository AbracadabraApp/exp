# Experience Cards Database

PostgreSQL database for the travel experience cards system.

## Architecture

**Lists are cards.** This is the core design principle:
- One `cards` table holds both experience-cards and list-cards
- No separate `lists` table or junction table (at current scale)
- List membership: `member_card_ids` JSONB array on list-cards
- Related lists query: find cards where `member_card_ids` contains target card ID

This design is intentionally scoped for **<1,000 cards**. Migration to junction table pattern happens when:
- Lists exceed ~200 members
- Total cards exceed ~5,000
- Performance degrades on list membership queries

## Schema Overview

### Card Types

**Experience-card** (describes one experience):
- Has `where_country` populated
- Null `member_card_ids`
- Example: "Attend pre-dawn fish auction in Gallipoli"

**List-card** (curated collection):
- Has `member_card_ids` populated (ordered array of card UUIDs)
- Null `where_country`
- Example: "Morning Rituals Worth Waking For" containing 15 experience-cards

### Key Fields

**Shared (all cards):**
- `headline`, `subhead`, `body` - Content
- `cover_image_url` - Image path (local: `/images/cards/{id}.jpg`)
- `themes` - JSONB array (controlled vocabulary, app-enforced)
- `status` - 'draft' | 'ready' | 'published' | 'archived'
- `prompt_version`, `generated_by` - Generation metadata

**Experience-card only:**
- `where_country`, `where_region`, `where_city` - Location
- `lat`, `lng`, `place_id` - Geographic data
- `when_season`, `when_time_of_day`, `when_specific_date` - Timing
- `source`, `source_type` - Citation
- `sensory_anchor` - One sensory detail

**List-card only:**
- `member_card_ids` - JSONB array of card UUIDs (ordered)
- `curator_notes` - Editorial intro

## Setup

### 1. Database Creation

```bash
# Create database
createdb exp_travel

# Set environment variable
export DATABASE_URL="postgresql://user:password@localhost:5432/exp_travel"
```

### 2. Run Migrations

```bash
# Run initial migration
psql $DATABASE_URL -f database/migrations/001_initial.sql

# Verify
psql $DATABASE_URL -c "SELECT * FROM schema_migrations;"
```

### 3. Verify Schema

```bash
# Check tables
psql $DATABASE_URL -c "\dt"

# Check indexes
psql $DATABASE_URL -c "\di"

# Check views
psql $DATABASE_URL -c "\dv"
```

## Data Access Layer

All database operations go through `lib/cards.js` - never write raw SQL in application code.

### Core Operations

```javascript
import { CardsService } from './lib/cards.js';

// Get single card
const card = await CardsService.getCard(cardId);

// Get multiple cards (preserves order)
const cards = await CardsService.getCardsByIds([id1, id2, id3]);

// Find lists containing a card
const lists = await CardsService.getListsContainingCard(cardId);

// Get cards by status
const drafts = await CardsService.getCardsByStatus('draft');
const published = await CardsService.getCardsByStatus('published', {
  country: 'italy',
  theme: 'morning_rituals',
  cardType: 'experience'
});

// Create card
const newCard = await CardsService.createCard({
  headline: 'Attend pre-dawn fish auction in Gallipoli',
  where_country: 'italy',
  where_region: 'Puglia',
  status: 'draft',
  themes: ['morning_rituals', 'markets_at_dawn'],
  prompt_version: '4.0',
  generated_by: 'claude-sonnet-4-6'
});

// Update card
const updated = await CardsService.updateCard(cardId, {
  status: 'ready',
  subhead: 'Where Pugliese fishermen sell the dawn catch'
});

// Update status only
await CardsService.updateCardStatus(cardId, 'published');
```

### List-Membership Operations

```javascript
// Add card to list (at end)
await CardsService.addCardToList(listId, cardId);

// Remove card from list
await CardsService.removeCardFromList(listId, cardId);

// Reorder all members
await CardsService.reorderListMembers(listId, [id1, id3, id2]);

// Insert at specific position
await CardsService.insertCardIntoList(listId, cardId, position);
```

## Controlled Vocabularies

Four dimensions use controlled vocabularies **enforced at application layer** (not DB constraints):

**1. when_season:**
- spring, summer, autumn, winter, year_round

**2. when_time_of_day:**
- pre_dawn, dawn, morning, midday, afternoon, evening, dusk, night, late_night, all_day, varies

**3. themes:**
- morning_rituals
- pilgrimage
- festivals_overlooked
- markets_at_dawn
- sacred_geography
- train_journeys
- hot_baths
- cinema_and_place
- music_in_place
- where_craft_survives
- drinks_worth_borders
- meals_worth_flight
- _(will grow over time)_

**4. where_country:**
- ISO-style lowercase: 'italy', 'japan', 'mexico', etc.

Vocabulary definitions live in `lib/vocabulary.js` (to be created when needed).

## Image Storage

**Current:** Local filesystem
- Images stored in: `/public/images/cards/`
- URLs stored as: `/images/cards/{card_id}.jpg`
- Served by Next.js static file handler

**Future:** Object storage (Cloudflare R2 or similar)
- Migration path: update all `cover_image_url` values to CDN URLs
- Schema does not change (stores URLs, not paths)

## Performance Characteristics

At current scale (hundreds of cards):

**Fast queries:**
- Get card by ID: <5ms
- Get cards by IDs (10-50 cards): <10ms
- Get cards by status + filters: <20ms
- Find lists containing card: <15ms (GIN index on member_card_ids)

**Watch for:**
- List-membership queries >50ms (consider junction table)
- Lists with >200 members (rewrite to junction table)
- Total cards >5,000 (revisit array pattern)

## Backup Strategy

**Required for production:** Daily automated backups using `pg_dump`.

### Backup Script (to be automated)

```bash
#!/bin/bash
# database/backup.sh

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/exp_travel_$DATE.sql"

mkdir -p $BACKUP_DIR

# Dump database
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Keep last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup created: $BACKUP_FILE.gz"
```

### Backup Schedule

- **Frequency:** Daily at 3am (low traffic)
- **Retention:** 30 days
- **Storage:** Local + off-site (S3/R2)
- **Test restore:** Monthly

### Restore Process

```bash
# Restore from backup
gunzip -c backups/exp_travel_20260504_030000.sql.gz | psql $DATABASE_URL
```

## Data Lifecycle

Cards move through status states:

1. **draft** → Generated by AI pipeline, not yet reviewed
2. **ready** → Passed editorial review, eligible for lists
3. **published** → Appears in live product
4. **archived** → Removed from live product but retained

Status transitions happen via application:

```javascript
await CardsService.updateCardStatus(cardId, 'published');
```

## Migration Pattern (for future schema changes)

When schema needs to change:

1. Create `database/migrations/00X_description.sql`
2. Add migration logic
3. Record in `schema_migrations` table
4. Run migration: `psql $DATABASE_URL -f database/migrations/00X_description.sql`
5. Update `database/schema.sql` to reflect current state

## Not Implemented (deferred per brief)

- User accounts, favorites, bookmarks
- Full-text search (basic LIKE queries sufficient for now)
- Card versioning or history
- Per-membership notes ("why this card is on this list")
- Computed quality scores
- Recommendation systems
- Web admin UI

These features wait for real product usage data.

## Connection Pool Configuration

Connection pool managed by `lib/db.js`:

- **Max connections:** 20
- **Idle timeout:** 30s
- **Connection timeout:** 2s

Adjust `lib/db.js` if needed for production load.

## Monitoring

**Watch these queries:**

```sql
-- Slow queries (>1s)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC;

-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

## Troubleshooting

### Connection issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT version();"

# Check pool status
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"
```

### Query performance

```bash
# Enable query logging in postgresql.conf
log_min_duration_statement = 500  # Log queries >500ms

# Or for one session:
psql $DATABASE_URL -c "SET log_min_duration_statement = 500;"
```

### Migration errors

```bash
# Check applied migrations
psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY version;"

# Rollback (manual - no automated rollback)
# Restore from backup, then re-run migrations up to last known good
```

## Testing

### Insert test data

```javascript
// Create experience-card
const experience = await CardsService.createCard({
  headline: 'Test Experience',
  where_country: 'italy',
  status: 'draft',
  themes: ['morning_rituals']
});

// Create list-card
const list = await CardsService.createCard({
  headline: 'Test List',
  member_card_ids: [experience.id],
  curator_notes: 'A test collection',
  status: 'draft',
  themes: ['morning_rituals']
});

// Verify list membership
const lists = await CardsService.getListsContainingCard(experience.id);
console.log(lists); // Should contain the test list
```

## Contact

Database questions: see project README or raise GitHub issue.
