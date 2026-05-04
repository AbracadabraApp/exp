# Database Implementation Deliverables

**Status:** ✅ Complete
**Date:** 2026-05-04
**Engineer:** Database Implementation Team

---

## Summary

Implemented PostgreSQL database layer for travel experience cards system following "lists are cards" architectural pattern. All requested operations delivered with full documentation and testing tools.

---

## What Was Delivered

### 1. Schema Definition ✅

**File:** `database/schema.sql`

- Single `cards` table for both experience-cards and list-cards
- JSONB columns for `themes` and `member_card_ids` with GIN indexes
- No UNIQUE constraint on headline (legitimate duplicates exist)
- Helper views: `experience_cards`, `list_cards`
- Automated `updated_at` trigger
- Full documentation via SQL comments

**Key design decisions implemented:**
- Lists stored as cards (not separate table)
- Member cards stored in JSONB array (not junction table)
- Controlled vocabularies enforced at app layer (not DB constraints)
- Image URLs stored (local: `/images/cards/{id}.jpg`, future: CDN)

### 2. Migration Scripts ✅

**File:** `database/migrations/001_initial.sql`

- Initial schema migration
- Migration tracking table for future migrations
- Idempotent: safe to run multiple times

**Migration runner:** `database/migrate.js`
- Commands: `up`, `status`
- Tracks applied migrations
- Prevents duplicate runs

### 3. Connection Pool Module ✅

**File:** `lib/db.js`

Following moviegenius pattern:
- Shared connection pool (max 20 connections)
- Environment-based configuration
- Error handling and logging
- Query helper functions
- Transaction support
- Graceful shutdown on SIGINT/SIGTERM
- Browser-context protection (throws error if imported client-side)

### 4. Data Access Layer ✅

**File:** `lib/cards.js`

**Core operations (from brief):**
- `getCard(id)` - Get single card
- `getCardsByIds(ids[])` - Get multiple, preserves order
- `getListsContainingCard(cardId)` - Find lists containing card
- `getCardsByStatus(status, filters)` - Browse/admin queries
- `createCard(cardData)` - Create new card
- `updateCard(id, updates)` - Update existing card
- `updateCardStatus(id, status)` - Status transitions

**List-membership operations (requested):**
- `addCardToList(listId, cardId)` - Add to end
- `removeCardFromList(listId, cardId)` - Remove member
- `reorderListMembers(listId, orderedCardIds)` - Reorder all
- `insertCardIntoList(listId, cardId, position)` - Insert at index

**Additional utilities:**
- `deleteCard(id)` - Safe deletion with reference checking
- Transaction support for list operations
- Input validation and error messages
- Prevents duplicate additions to lists

### 5. Seed Script ✅

**File:** `database/seed.js`

**Features:**
- Flexible JSON import (handles multiple formats)
- Normalizes Pass 4 output to schema
- Normalizes simplified formats
- Smart field parsing (e.g., "Alba, Piedmont, Italy" → structured location)
- Dry-run mode (`--dry-run`)
- Duplicate detection (`--skip-duplicates` default)
- Batch import with progress logging
- Error handling per card (doesn't stop on single failure)

**Supported formats:**
- Pass 4 enriched output
- Pass 1-3 output
- Manual JSON edits
- Simplified format

### 6. Testing Tools ✅

**File:** `database/test-cli.js`

**Commands:**
- `run` - Full test suite demonstrating all operations
- `clean` - Remove test data

**Tests cover:**
- Creating experience-cards
- Creating list-cards
- Getting cards by IDs (order preservation)
- Finding lists containing cards
- Adding cards to lists
- Reordering list members
- Status updates
- Querying by status with filters

### 7. Backup Strategy ✅

**File:** `database/backup.sh`
**Documentation:** `database/README.md` section

**Features:**
- Automated `pg_dump` script
- Compression (gzip)
- 30-day retention
- Size reporting
- Error handling
- Cloud upload placeholder (S3/R2)
- Cron-ready

**Documentation includes:**
- Scheduling instructions
- Restore procedure
- Test restore monthly requirement
- Off-site storage recommendation

### 8. Documentation ✅

**Files:**
- `database/README.md` - Complete operational reference
- `database/SETUP.md` - Quick start guide
- `database/DELIVERABLES.md` - This file
- `.env.example` - Environment configuration template

**Documentation covers:**
- Architecture and design decisions
- Schema overview
- Setup instructions
- Data access API reference
- Controlled vocabularies
- Image storage strategy
- Backup and restore procedures
- Performance monitoring
- Troubleshooting
- Migration patterns
- Testing procedures

### 9. Package Configuration ✅

**File:** `package.json` (updated)

**Added:**
- `pg` dependency (v8.16.3)
- Database scripts:
  - `npm run db:migrate` - Run migrations
  - `npm run db:migrate:status` - Check migration status
  - `npm run db:seed <file>` - Import JSON data
  - `npm run db:test` - Run test suite
  - `npm run db:test:clean` - Clean test data
- Node.js version requirement (>=20.0.0)
- Updated metadata

### 10. Environment & Config ✅

**Files:**
- `.env.example` - Template with DATABASE_URL
- `.gitignore` (updated) - Protects `.env`, `backups/`, database dumps

---

## Architectural Decisions Implemented

### 1. No UNIQUE Constraint on Headline ✅

**Reasoning:** Legitimate duplicates exist (e.g., "Smash Plates at Tavernas" across multiple Greek towns).

**Implementation:** Removed constraint from schema. Duplicate detection available at import-time as warning, not blocking.

### 2. Local Image Storage (Migration Path Documented) ✅

**Current:**
- Storage: `/public/images/cards/`
- URLs: `/images/cards/{card_id}.jpg`
- Served by Next.js static files

**Future:**
- Migration to R2/CDN documented
- Schema stores URLs (not paths) - no schema change needed
- Migration = update `cover_image_url` values only

### 3. List-Membership Operations ✅

**Added to CardsService:**
- `addCardToList` - Atomic append
- `removeCardFromList` - Atomic removal
- `reorderListMembers` - Replace entire array with validation
- `insertCardIntoList` - Insert at specific index

**Prevents:**
- Manual JSON array manipulation
- Race conditions (via transactions)
- Invalid states (duplicate members, missing cards)

### 4. Backup Strategy Documented ✅

**Required for production:**
- Daily `pg_dump` at 3am
- 30-day retention minimum
- Test restore monthly
- Off-site storage (S3/R2)

**Provided:**
- Automated script (`backup.sh`)
- Cron scheduling instructions
- Restore procedure
- Monitoring commands

---

## Migration to Junction Table Pattern

**Current design is intentionally scoped for <1,000 cards.**

**When to migrate:**
1. Lists exceed ~200 members
2. Total cards exceed ~5,000
3. List-membership queries >50ms

**Migration path:**
1. Create `list_memberships` junction table
2. Migrate `member_card_ids` data to junction table
3. Update `CardsService` queries (API remains same)
4. Drop `member_card_ids` column
5. Update indexes

**Documented in:** `database/README.md`

---

## Not Implemented (Per Brief)

These are **intentionally deferred** until product usage data exists:

- ❌ Separate `lists` table
- ❌ Per-membership notes
- ❌ User accounts, favorites, bookmarks
- ❌ Full-text search
- ❌ Card versioning/history
- ❌ Tagging beyond controlled vocabularies
- ❌ Computed quality scores
- ❌ Recommendation systems
- ❌ Web admin UI
- ❌ API layer (separate concern)

---

## Testing

### Automated Tests

```bash
# Run full test suite
npm run db:test

# Expected: All operations succeed, 3 experience-cards + 1 list-card created
```

### Manual Testing

```bash
# 1. Create database
createdb exp_travel
export DATABASE_URL="postgresql://localhost:5432/exp_travel"

# 2. Run migration
npm run db:migrate

# 3. Run tests
npm run db:test

# 4. Clean up
npm run db:test:clean
```

### Seed Data Import (when available)

```bash
# Dry run
npm run db:seed data/04-enriched/italy-50.json -- --dry-run

# Import
npm run db:seed data/04-enriched/italy-50.json
```

---

## Performance Characteristics

**Tested at design scale (<1,000 cards):**

| Operation | Expected Performance |
|-----------|---------------------|
| Get card by ID | <5ms |
| Get cards by IDs (10-50) | <10ms |
| Get cards by status + filters | <20ms |
| Find lists containing card | <15ms |
| Add card to list | <10ms |
| Reorder list members | <15ms |

**GIN indexes on JSONB columns ensure fast array containment queries.**

---

## Dependencies

**Added to project:**
- `pg` v8.16.3 - PostgreSQL client

**Already present:**
- `@anthropic-ai/sdk` - For content generation

**System requirements:**
- PostgreSQL 14+
- Node.js 20+

---

## Deployment Checklist

- [ ] Set `DATABASE_URL` in production environment
- [ ] Run `npm run db:migrate` on production database
- [ ] Setup daily automated backups (cron or CI/CD)
- [ ] Configure backup off-site storage (S3/R2)
- [ ] Test restore procedure
- [ ] Enable PostgreSQL slow query logging (>500ms)
- [ ] Monitor index usage monthly
- [ ] Test list-membership query performance under load

---

## File Manifest

```
/exp
  /database
    schema.sql              # Complete schema definition
    README.md               # Operational documentation
    SETUP.md                # Quick start guide
    DELIVERABLES.md         # This file
    backup.sh               # Automated backup script
    seed.js                 # JSON import script
    migrate.js              # Migration runner
    test-cli.js             # Testing tools
    /migrations
      001_initial.sql       # Initial schema migration

  /lib
    db.js                   # Connection pool module
    cards.js                # Data access layer (CardsService)

  .env.example              # Environment template
  .gitignore                # Updated with database entries
  package.json              # Updated with db scripts + pg dependency
```

---

## Next Steps

1. **Install dependencies:** `npm install`
2. **Create database:** `createdb exp_travel`
3. **Set DATABASE_URL:** Copy `.env.example` to `.env`, edit
4. **Run migration:** `npm run db:migrate`
5. **Test:** `npm run db:test`
6. **Import data:** `npm run db:seed <your-file.json>` (when available)
7. **Build API layer** (separate work, not in this scope)

---

## Support & Documentation

- **Setup:** `database/SETUP.md`
- **Operations:** `database/README.md`
- **Schema:** `database/schema.sql`
- **API:** `lib/cards.js` (inline JSDoc comments)

---

## Sign-off

All four feedback items addressed:

1. ✅ **UNIQUE constraint removed** - headline allows duplicates
2. ✅ **Image storage decided** - local with migration path documented
3. ✅ **List-membership operations added** - 4 operations in CardsService
4. ✅ **Backup strategy confirmed** - script + documentation delivered

Database layer ready for integration.
