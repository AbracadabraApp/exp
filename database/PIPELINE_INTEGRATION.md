# Pipeline Integration Guide

How the 4-pass content generation pipeline integrates with the database.

## Overview

The pipeline generates travel experience cards through 4 passes:

1. **Pass 1: Research** - Generate raw candidates (355 created)
2. **Pass 2: Plausibility Check** - Filter fabrications (~75% survival)
3. **Pass 3: Quality Filter** - Editorial critique + writer persona assignment (~60-70% survival)
4. **Pass 4: Enrichment** - Write in editorial voice

The database tracks progress through all passes and stores metadata for monitoring.

---

## Database Schema Changes

### Migration 002: Pipeline Metadata

Run this migration to add pipeline support:

```bash
npm run db:migrate
```

This adds:

**Writer Persona:**
- `writer_type` - Assigned in Pass 3, used in Pass 4
- Values: `travel_writer`, `food_enthusiast`, `religious_scholar`, `sailor`, `historian`

**Pass Tracking:**
- `pass1_timestamp` - When generated
- `pass2_plausible` - Boolean: passed plausibility check?
- `pass2_reasoning` - Why plausible/implausible
- `pass2_timestamp` - When checked
- `pass3_verdict` - `ACCEPT`, `REJECT`, or `REVISE`
- `pass3_revision_feedback` - Feedback if verdict was `REVISE`
- `pass3_revision_count` - How many times revised (max 1)
- `pass3_timestamp` - When critiqued
- `pass4_timestamp` - When enriched

**Rejection Tracking:**
- `rejected_at_pass` - Which pass killed it: `pass2`, `pass3`, or null
- `rejection_reason` - Why rejected

**Status Pipeline:**
- `draft` - Pass 1 output (raw candidate)
- `pass2_plausible` - Survived Pass 2
- `pass3_approved` - Survived Pass 3
- `ready` - Pass 4 complete (ready for editorial review)
- `published` - Human-approved and live
- `rejected` - Killed in Pass 2 or 3
- `archived` - Deprecated

---

## Data Flow Through Pipeline

### Pass 1 → Database

**JSON format:**
```json
{
  "experience": "Attend the pre-dawn truffle auction at Alba's Fiera",
  "where": "Alba, Piedmont, Italy",
  "when": "October–November, Saturday mornings, 6-7am",
  "why_distinctive": "Pre-dawn negotiation culture among hunters",
  "source": "Matt Goulding, 'Pasta, Pane, Vino' (2018), pp. 41-47"
}
```

**Database insert:**
```javascript
await CardsService.createCard({
  headline: data.experience,  // Use experience as temporary headline
  where_country: 'italy',     // Parsed from "where"
  where_region: 'Piedmont',
  where_city: 'Alba',
  source: data.source,
  status: 'draft',
  pass1_timestamp: new Date(),
  generated_by: 'pass1-research'
});
```

**Note:** Pass 1 output has no `headline`/`subhead`/`body` yet - those come from Pass 4.

---

### Pass 2 → Database

**JSON format (adds to Pass 1):**
```json
{
  "pass2_plausible": true,
  "pass2_verdict": "PLAUSIBLE",
  "pass2_reasoning": "Alba's truffle fair is well-documented; pre-dawn auction culture is plausible"
}
```

**Database update:**
```javascript
if (verdict === 'PLAUSIBLE') {
  await CardsService.updateCard(cardId, {
    pass2_plausible: true,
    pass2_reasoning: data.pass2_reasoning,
    pass2_timestamp: new Date(),
    status: 'pass2_plausible'
  });
} else {
  await CardsService.updateCard(cardId, {
    pass2_plausible: false,
    pass2_reasoning: data.pass2_reasoning,
    pass2_timestamp: new Date(),
    rejected_at_pass: 'pass2',
    rejection_reason: 'implausible',
    status: 'rejected'
  });
}
```

---

### Pass 3 → Database

**JSON format (adds to Pass 2):**
```json
{
  "pass3_verdict": "ACCEPT",
  "writer_type": "food_enthusiast",
  "writer_type_rationale": "Focus on ingredient sourcing and culinary tradition"
}
```

Or if needs revision:
```json
{
  "pass3_verdict": "REVISE",
  "pass3_revision_feedback": "Too generic - add more specific sensory details"
}
```

**Database update (ACCEPT):**
```javascript
await CardsService.updateCard(cardId, {
  pass3_verdict: 'ACCEPT',
  writer_type: data.writer_type,
  pass3_timestamp: new Date(),
  status: 'pass3_approved'
});
```

**Database update (REVISE):**
```javascript
await CardsService.updateCard(cardId, {
  pass3_verdict: 'REVISE',
  pass3_revision_feedback: data.pass3_revision_feedback,
  pass3_revision_count: currentCount + 1,
  pass3_timestamp: new Date()
  // Status stays at 'pass2_plausible' - will be revised and re-evaluated
});
```

**Database update (REJECT):**
```javascript
await CardsService.updateCard(cardId, {
  pass3_verdict: 'REJECT',
  pass3_timestamp: new Date(),
  rejected_at_pass: 'pass3',
  rejection_reason: 'quality',
  status: 'rejected'
});
```

---

### Pass 4 → Database

**JSON format (adds headline, subhead, body):**
```json
{
  "headline": "Arrive Before Dawn at Alba's White Truffle Auction",
  "subhead": "The real truffle trade happens in whispers before tourists arrive",
  "full_entry": "The trifolau arrive before 7am with woven baskets...",
  "sensory_anchor": "The smell of damp earth and truffle",
  "pass4_model": "claude-sonnet-4-6"
}
```

**Database update:**
```javascript
await CardsService.updateCard(cardId, {
  headline: data.headline,
  subhead: data.subhead,
  body: data.full_entry,  // Note: full_entry → body
  sensory_anchor: data.sensory_anchor,
  pass4_timestamp: new Date(),
  status: 'ready',
  generated_by: data.pass4_model  // Override Pass 1 model
});
```

---

## Field Mapping Reference

| Pass Output | Database Column | Notes |
|-------------|----------------|-------|
| `experience` | `headline` (temp) | Overwritten by Pass 4 `headline` |
| `where` | Parse → `where_city`, `where_region`, `where_country` | Use `parse_location()` helper |
| `when` | Parse → `when_season`, `when_time_of_day` | Extract from text |
| `why_distinctive` | Not stored | Used for Pass 2/3 evaluation only |
| `source` | `source` | Direct mapping |
| `headline` | `headline` | Pass 4 only |
| `subhead` | `subhead` | Pass 4 only |
| `full_entry` | `body` | Pass 4 only |
| `writer_type` | `writer_type` | Pass 3 only |
| `pass4_model` | `generated_by` | Pass 4 only |

---

## Helper Functions

### Parse Location String

```javascript
// "Alba, Piedmont, Italy" → { city: "Alba", region: "Piedmont", country: "italy" }
function parseLocation(whereString) {
  const parts = whereString.split(',').map(s => s.trim());

  return {
    where_city: parts[0] || null,
    where_region: parts[1] || null,
    where_country: parts[2]?.toLowerCase() || null
  };
}
```

### Parse Timing String

```javascript
// "October–November, Saturday mornings, 6-7am" → { season: "autumn", time_of_day: "morning" }
function parseTiming(whenString) {
  const seasons = {
    'January': 'winter', 'February': 'winter', 'December': 'winter',
    'March': 'spring', 'April': 'spring', 'May': 'spring',
    'June': 'summer', 'July': 'summer', 'August': 'summer',
    'September': 'autumn', 'October': 'autumn', 'November': 'autumn'
  };

  const timeOfDay = {
    'pre-dawn': 'pre_dawn',
    'dawn': 'dawn',
    'morning': 'morning',
    'midday': 'midday',
    'afternoon': 'afternoon',
    'evening': 'evening',
    'night': 'night'
  };

  let season = 'year_round';
  let time = null;

  // Check for month names
  for (const [month, s] of Object.entries(seasons)) {
    if (whenString.includes(month)) {
      season = s;
      break;
    }
  }

  // Check for time of day
  for (const [phrase, t] of Object.entries(timeOfDay)) {
    if (whenString.toLowerCase().includes(phrase)) {
      time = t;
      break;
    }
  }

  return { when_season: season, when_time_of_day: time };
}
```

---

## Monitoring Pipeline Progress

### Check overall progress

```sql
SELECT * FROM pipeline_progress;
```

Output:
```
  status          | total | pass1_complete | pass2_complete | pass2_survived | pass3_complete | pass3_accepted | pass4_complete | rejected
------------------+-------+----------------+----------------+----------------+----------------+----------------+----------------+----------
  draft           |   100 |            100 |              0 |              0 |              0 |              0 |              0 |        0
  pass2_plausible |    75 |             75 |             75 |             75 |              0 |              0 |              0 |        0
  pass3_approved  |    50 |             50 |             50 |             50 |             50 |             50 |              0 |        0
  ready           |    30 |             30 |             30 |             30 |             30 |             30 |             30 |        0
  rejected        |    45 |             45 |             45 |              0 |             45 |              0 |              0 |       45
```

### Check where cards are being rejected

```sql
SELECT * FROM rejected_cards_analysis;
```

Output:
```
  rejected_at_pass | count | percentage
-------------------+-------+------------
  pass2            |    25 |      55.56
  pass3            |    20 |      44.44
```

### Find cards ready for next pass

```sql
-- Ready for Pass 2
SELECT id, headline FROM cards
WHERE status = 'draft' AND pass2_timestamp IS NULL
LIMIT 10;

-- Ready for Pass 3
SELECT id, headline FROM cards
WHERE status = 'pass2_plausible' AND pass3_timestamp IS NULL
LIMIT 10;

-- Ready for Pass 4
SELECT id, headline, writer_type FROM cards
WHERE status = 'pass3_approved' AND pass4_timestamp IS NULL
LIMIT 10;
```

---

## Seed Script Integration

The seed script (`database/seed.js`) should detect which pass the JSON came from and map accordingly:

```javascript
function detectPassLevel(data) {
  if (data.headline && data.full_entry) return 4;  // Pass 4: has enriched content
  if (data.pass3_verdict) return 3;                // Pass 3: has quality verdict
  if (data.pass2_verdict) return 2;                // Pass 2: has plausibility check
  if (data.experience) return 1;                   // Pass 1: raw candidate
  return 0;
}

async function importCard(data) {
  const passLevel = detectPassLevel(data);

  switch (passLevel) {
    case 1:
      return importPass1Card(data);
    case 2:
      return importPass2Card(data);
    case 3:
      return importPass3Card(data);
    case 4:
      return importPass4Card(data);
    default:
      throw new Error('Unknown data format');
  }
}
```

---

## Production Workflow

### 1. Generate candidates (Pass 1)

```bash
node scripts/generate-all-countries.js
# Creates: 355 raw candidates in JSON files
```

### 2. Import to database

```bash
npm run db:seed italian-experiences-50.json
# Status: draft, pass1_timestamp set
```

### 3. Run Pass 2 (plausibility check)

```bash
node scripts/pass2_plausibility.js
# Reads from data/01-research/
# Updates database: status → pass2_plausible or rejected
```

### 4. Run Pass 3 (quality filter)

```bash
node scripts/pass3_quality.js  # To be built
# Reads from data/02-plausible/
# Updates database: status → pass3_approved or rejected
# Assigns writer_type
```

### 5. Run Pass 4 (enrichment)

```bash
node scripts/pass4_enrich.js  # To be built
# Reads from data/03-quality-passed/
# Updates database: adds headline, subhead, body
# Status → ready
```

### 6. Editorial review

Human reviews cards with `status = 'ready'` and approves for publication.

```bash
# Mark as published
npm run db:publish <card-id>
```

---

## Next Steps

1. **Run migration 002** to add pipeline columns
2. **Update seed script** to handle all 4 pass formats
3. **Test import** with existing Pass 1 output
4. **Build Pass 3 & 4 scripts** with database integration
5. **Setup monitoring** using `pipeline_progress` view

---

## Support

- Schema reference: `database/schema.sql`
- Migration: `database/migrations/002_pipeline_metadata.sql`
- Setup guide: `database/SETUP.md`
- Main README: `README.md`
