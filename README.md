# Experience-First Travel Catalog Pipeline

**A 3-pass content generation pipeline for creating curated, discovery-focused travel experiences.**

## Product Type

This is an **entertainment/discovery product** (like Atlas Obscura or a curated magazine feed), not a guidebook or itinerary planner.

Users browse for inspiration ("oh wow, that exists?"), save interesting experiences, and use them as starting points for future travel. The bar is **plausibility and interest**, not citation-perfect accuracy.

## Philosophy

Instead of "Where should I go?" → "What do I want to experience?"

The destination becomes a consequence of the experience you're seeking, not the starting point.

This project generates **distinctive, plausible travel experiences** (food, rituals, seasonal moments) that most travelers don't know exist.

---

## The 3-Pass Pipeline

**Simplified for entertainment product** - focuses on plausibility and interest over citation verification.

### Pass 1: Research (Generate Candidates)
**Status:** ✅ Complete - 355 experiences generated

Generates raw experience candidates using Claude Sonnet 4.6.

- **Input:** Sub-domain prompts (e.g., "Italian food rituals", "French aperitif culture")
- **Output:** JSON with `experience`, `where`, `when`, `why_distinctive`, `source`
- **Model:** Sonnet 4.6
- **Cost:** ~$1 per 20-30 experiences

**Quality criteria:**
- Specific moment, ritual, or activity (not "visit the museum")
- Has clear when/where/with whom
- Plausible and real (not invented festivals or rituals)
- Most travelers don't know it exists
- Optional: Cited source for context (book, article, documentary, website) - adds flavor but not required for verification

**Generated to date:**
- Italy: 50 experiences
- France: 30 experiences
- Spain: 20 experiences
- United States: 30 experiences
- Turkey: 30 experiences
- Mexico: 30 experiences
- Greece: 30 experiences
- Japan: 30 experiences
- Austria: 30 experiences
- Thailand: 17 experiences
- Germany: 30 experiences
- China: 28 experiences

**Total:** 355 raw candidates

### Pass 2: Plausibility Check (Lightweight Filter)
**Status:** 📋 Ready to build

Lightweight check to filter out obvious fabrications without deep source verification.

- **Model:** Sonnet 4.6
- **Single question:** "Is this experience plausible and real, or did the model invent something that doesn't exist?"
- **Output:** `PLAUSIBLE`, `IMPLAUSIBLE`
- **Expected survival:** 75-85%

**Catches:**
- Complete fabrications ("daily ice sculpture festival in Naples")
- Invented festivals, dishes, or rituals that don't exist
- Implausible timing or geographic mismatches

**Doesn't waste time on:**
- Page number verification
- URL fetching
- Source citation accuracy

**Why this is enough:** For an entertainment product, users will do a quick Google search if curious. The bar is "can a curious user confirm this exists?" not "is this citation academically correct?"

### Pass 3: Quality + Writer Persona (Editorial Filter)
**Status:** 📋 Not yet built

Adversarial critic evaluates if plausible experiences are actually interesting enough to ship.

- **Model:** Sonnet 4.6 (or Opus 4.7 for better editorial taste)
- **Checks:**
  - Is it interesting enough to earn attention?
  - Is it specific and distinctive (not generic tourism)?
  - Does it have the right emotional register?
- **Output:** `ACCEPT`, `REJECT`, or `REVISE` (with feedback)
- **Expected survival:** ~60-70% of Pass 2 survivors

**Also assigns writer persona** (determines Pass 4 voice):
- `travel_writer` - Sensory, immediate, present-tense
- `food_enthusiast` - Ingredient-focused, technique-aware
- `religious_scholar` - Contemplative, historical context
- `sailor` - Maritime, tidal, coastal life
- `historian` - Layered time, deep continuity

**Pass 3.5 (Revision loop):**
- If verdict is `REVISE`, improves candidate with specific feedback
- Revised candidate goes back through Pass 3 critique
- Max 1 revision attempt per candidate

### Pass 4: Enrichment (Write in Voice)
**Status:** 📋 Not yet built

Takes verified, quality-approved candidates and writes them in editorial voice.

- **Input:** Pass 3 survivors with assigned writer persona
- **Output:** Headline, subhead, full entry paragraph, sensory details
- **Model:** Sonnet 4.6 (or Opus 4.7 for highest quality)
- **Voice:** Applied based on writer persona tag from Pass 3

**5 Writer Personas:**

1. **Travel Writer** - "You arrive before dawn. The market hall smells of salt and diesel..."
2. **Food Enthusiast** - "The frisella soaks in morning seawater, softening just enough..."
3. **Religious Scholar** - "The procession has followed this route since the 14th century..."
4. **Sailor** - "The auction begins at slack tide, when the boats return..."
5. **Historian** - "The same families have gathered here each October since..."

---

## Directory Structure

```
/exp
  /scripts
    generate-all-countries.js       # Pass 1: Multi-country batch generator
    pass2_plausibility.js           # Pass 2: Plausibility check
    create_test_sample.js           # Helper: Creates 20-sample test set

  /prompts
    research.txt                    # Pass 1 prompt template
    plausibility_check.txt          # Pass 2 prompt (lightweight plausibility)

  /data
    /01-research                    # Pass 1 output (raw candidates)
    /02-plausible                   # Pass 2 output (plausible candidates)
    /03-quality-passed              # Pass 3 output (quality-approved)
    /04-enriched                    # Pass 4 output (ready to ship)
    /99-killed                      # Rejected candidates (with reasons)

  # Generated country files (Pass 1 output)
  italian-experiences-50.json
  france-experiences.json
  spain-experiences.json
  mexico-experiences.json
  # ... etc
```

---

## Running the Pipeline

### Pass 1: Generate Experiences

**Multi-country batch:**
```bash
node --env-file=../overt-tourism/server/.env generate-all-countries.js
```

Generates 30 experiences each for 11 countries (France, Spain, USA, Turkey, Mexico, Greece, Japan, Austria, Thailand, Germany, China).

**Single domain:**
```bash
node --env-file=../overt-tourism/server/.env test-italian.js
```

### Pass 2: Plausibility Check

**Create test sample (20 diverse candidates):**
```bash
node scripts/create_test_sample.js
```

**Run plausibility check:**
```bash
node --env-file=../overt-tourism/server/.env scripts/pass2_plausibility.js
```

Processes all JSON files in `data/01-research/`, outputs to `data/02-plausible/` or `data/99-killed/`.

**Review results:**
- Check survival rate (target: 75-85%)
- Spot-check 5 verdicts manually to calibrate accuracy

### Pass 3: Quality Filter
*Not yet built*

### Pass 4: Enrichment
*Not yet built*

---

## Model Strategy

| Pass | Task | Model | Why |
|------|------|-------|-----|
| 1 | Research | Sonnet 4.6 | Knowledge recall, grounded specificity |
| 2 | Plausibility check | Sonnet 4.6 | Judgment on whether experience is real or fabricated |
| 3 | Quality critique | Sonnet 4.6 (or Opus) | Editorial judgment |
| 3.5 | Revision | Sonnet 4.6 | Same as Pass 3 for consistency |
| 4 | Voice enrichment | Sonnet 4.6 → Opus 4.7 | Output quality matters most |

**Cost projection (for 500 candidates through full pipeline):**
- Pass 1 (500 candidates): ~$25
- Pass 2 (500 plausibility checks): ~$5
- Pass 3 (375 survivors @ 75%): ~$12
- Pass 3.5 (50 revisions): ~$1.50
- Pass 4 (200 enrichments, Sonnet): ~$7

**Total:** ~$50 with Sonnet-heavy stack, ~$80-100 if using Opus for Pass 4.

---

## Quality Gates

### After Pass 1 (Research)
✅ **Done** - 355 candidates generated

**Review:** Manually check 5-10 samples for:
- Are experiences specific and distinctive?
- Are sources cited properly?
- Is there good geographic/domain diversity?

### After Pass 2 (Plausibility Check)
📋 **Not yet tested**

**Gate:** Don't proceed to Pass 3 until:
- Survival rate is 75-85% (if <70%, tune Pass 2 prompt)
- Spot-check 5 verdicts manually - are they accurate?
- Fabrications are caught, plausible experiences pass

### After Pass 3 (Quality)
📋 **Not yet built**

**Gate:** Don't proceed to Pass 4 until:
- Survival rate is ~60% of Pass 2 survivors
- Rejections are correct (boring-but-true are killed)
- Writer persona tags make sense

### After Pass 4 (Enrichment)
📋 **Not yet built**

**Review:** Human review of enriched entries
- Voice quality consistent across personas?
- Entries are shippable?
- Accept/reject/edit each entry

---

## Testing Strategy

### Phase 1: Validate Pass 2 (Current)
1. ✅ Create 20 diverse test samples (5 Italy, 5 Mexico, 5 France, 3 China, 2 Thailand)
2. 📋 Build Pass 2 plausibility check
3. 📋 Run on 20 test samples
4. 📋 Measure survival rate (target: 75-85%)

### Phase 2: Build & Validate Pass 3
5. Build Pass 3 quality critic
6. Run on Pass 2 survivors (~12-15 expected)
7. Should kill another 30-40% (boring-but-true)
8. Review ~8-10 finalists manually

### Phase 3: Scale Pipeline
9. If quality is good: run all 355 experiences through Pass 2 → Pass 3
10. Expected output: 150-210 quality-approved candidates
11. Build Pass 4 and enrich

---

## Design Decisions

### Why Writer Personas Instead of Geographic Voices?

**Wrong approach:** "Italian voice" vs "Mexican voice" vs "Japanese voice"

**Right approach:** Writer lens based on content type:
- A monastery experience in Italy gets "religious scholar" voice
- A monastery experience in Japan gets the same voice
- Consistency across similar experience types

This is how real editorial works - the writer's lens determines the voice, not the geography.

### Why Multiple Passes Instead of 1?

**Pass 1 alone produces:**
- High volume (~80% of candidates meet surface criteria)
- But: Some fabricated experiences slip through
- And: ~30% of real candidates are boring-but-true
- Result: Only ~50-60% are actually shippable

**Full pipeline produces:**
- Lower volume (~50-60% survive all passes)
- But: Every survivor is plausible, interesting, and written in voice
- Result: Ship-ready content

The pipeline trades quantity for quality and automation.

### Why Lightweight Plausibility Over Deep Verification?

**Product type determines verification bar:**

For a guidebook/itinerary planner, you'd need:
- Citation verification (page numbers, URLs)
- Source accuracy checks
- Cross-referencing multiple sources

For an entertainment/discovery product (this project), you need:
- Plausibility check (is this real or fabricated?)
- Interest filter (is this worth attention?)
- Quality enrichment (is it well-written?)

**The user will verify if curious:** A quick Google search confirms "Palio della Riva truffle auction" exists. That's enough for a discovery product. We don't need to verify Matt Goulding's book pages 41-47 are accurate.

---

## Current Status

### Completed
- ✅ Pass 1: Generated 355 experiences across 12 countries
- ✅ Pass 2: Built and tested plausibility check (75% survival rate)
- ✅ Test infrastructure: 20-sample test set, directory structure
- ✅ Documentation updated to reflect entertainment product approach
- ✅ Database schema + migration for pipeline integration

### Next Steps
1. Build Pass 3 (quality critic with writer persona tagging)
2. Test Pass 3 on Pass 2 survivors (~12-15 expected from 20 samples)
3. Build Pass 4 (voice enrichment with 5 persona templates)
4. Scale: Run all 355 through Pass 2 → Pass 3 → Pass 4
5. Import enriched cards to database
6. Editorial review + publish

---

## Example Output

### Pass 1 Output (Raw Candidate)
```json
{
  "experience": "Attend the 'Palio della Riva' truffle weighing and auction at the Fiera Internazionale del Tartufo Bianco d'Alba",
  "where": "Alba, Piedmont — pre-dawn market near Piazza Medford",
  "when": "October–November, Saturday and Sunday mornings, 6–7am",
  "why_distinctive": "The public fair is well known; the pre-dawn negotiation culture among hunters and restaurateurs is separate, undocumented ritual",
  "source": "Matt Goulding, 'Pasta, Pane, Vino' (2018), pp. 41–47"
}
```

### Pass 2 Output (Plausibility Checked)
```json
{
  // ... all Pass 1 fields ...
  "pass2_plausible": true,
  "pass2_verdict": "PLAUSIBLE",
  "pass2_reasoning": "The Alba white truffle fair is well-documented; pre-dawn auction culture among hunters and restaurateurs is plausible and specific",
  "pass2_timestamp": "2026-05-04T15:30:00Z"
}
```

### Pass 3 Output (Quality-Approved with Persona)
```json
{
  // ... all Pass 1 & 2 fields ...
  "pass3_verdict": "ACCEPT",
  "writer_type": "food_enthusiast",
  "writer_type_rationale": "Focus on ingredient sourcing, negotiation ritual, and culinary tradition"
}
```

### Pass 4 Output (Enriched)
```json
{
  // ... all previous fields ...
  "headline": "Arrive Before Dawn at Alba's White Truffle Auction",
  "subhead": "The real truffle trade happens in whispers and handshakes before the crowds arrive",
  "full_entry": "The trifolau arrive before 7am with woven baskets lined in cloth. The truffles are weighed on analog scales under fluorescent lights. Prices are negotiated in murmured Piedmontese, sealed with a handshake. By the time the tourist market opens at 10am, the best specimens are already gone — sold to restaurants across northern Italy in transactions invisible to visitors.",
  "pass4_model": "claude-sonnet-4-6",
  "pass4_timestamp": "2026-05-04T15:30:00Z"
}
```

---

## Database Integration

The pipeline outputs are designed to populate a PostgreSQL database for the overt-tourism app.

**Database documentation:**
- `database/SETUP.md` - Setup guide for PostgreSQL + migrations
- `database/PIPELINE_INTEGRATION.md` - How pipeline data flows into database
- `database/schema.sql` - Full schema with cards table
- `database/migrations/002_pipeline_metadata.sql` - Pipeline tracking columns

**Key features:**
- Single `cards` table holds both experience-cards and list-cards
- Pipeline metadata columns track progress through Pass 1→2→3→4
- `writer_type` column stores Pass 3 persona assignment
- `status` field tracks: `draft` → `pass2_plausible` → `pass3_approved` → `ready` → `published`
- Helper views (`pipeline_progress`, `rejected_cards_analysis`) for monitoring

---

## Related Projects

This is a standalone experiment in the `/exp` directory, separate from but related to:

- **overt-tourism** - iOS app + Node.js/Hono backend for travel catalog browsing
- **MovieGenius** - Movie discovery app with Claude-enriched content

The pipeline developed here feeds content into overt-tourism's catalog via the database.

---

## References

The multi-pass pipeline design comes from a conversation about building scalable content generation systems. Key insights:

- **Pass 1 (Research):** Use explicit "fewer is fine" instruction to prevent padding
- **Pass 2 (Plausibility):** Lightweight check catches fabrications without over-engineering verification
- **Pass 3 (Quality):** Adversarial critic does most quality work; boring candidates die here
- **Pass 4 (Enrichment):** Output quality matters most - worth spending on Opus if needed

**Product type determines pipeline complexity:** Entertainment/discovery products need plausibility + interest, not citation-perfect verification.

---

## License

ISC

## Author

Josh Petersen
