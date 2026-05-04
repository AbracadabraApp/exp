# Experience-First Travel Catalog Pipeline

**A 4-pass content generation and verification pipeline for creating curated, source-grounded travel experiences.**

## Philosophy

Instead of "Where should I go?" → "What do I want to experience?"

The destination becomes a consequence of the experience you're seeking, not the starting point.

This project generates **distinctive, well-documented travel experiences** (food, rituals, seasonal moments) that most travelers don't know exist.

---

## The 4-Pass Pipeline

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
- Documented in travel writing, not just marketing copy
- Most travelers don't know it exists
- Cited source (book, article, documentary, website)

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

### Pass 2: Verification (Check Sources)
**Status:** 🏗️ In Testing - 20 sample candidates

Validates that cited sources actually support the claims.

- **Pass 2A (URL sources):** Fetches page content, verifies claim matches (Haiku 4.5)
- **Pass 2B (Non-URL sources):** Checks if book/article/documentary plausibly exists and covers topic (Sonnet 4.6)
- **Output:** `VERIFIED`, `PARTIALLY_VERIFIED`, `UNVERIFIABLE`, `FABRICATED`
- **Expected survival:** 60-75%

**Kills:**
- Fabricated sources
- Wrong page numbers/citations
- Generic marketing content that doesn't support specific claims
- Unverifiable or contradictory content

**Flags for human review:**
- Obscure but plausible sources
- Unusually specific claims that are hard to fabricate

### Pass 3: Quality Filter (Editorial Critique)
**Status:** 📋 Not yet built

Adversarial critic evaluates if verified experiences are actually interesting.

- **Model:** Sonnet 4.6 (or Opus 4.7 for better editorial taste)
- **Checks:** Is it specific enough? Too touristy? Worth the trip?
- **Output:** `ACCEPT`, `REJECT`, or `REVISE` (with feedback)
- **Expected survival:** ~60% of Pass 2 survivors

**Also assigns writer persona:**
- `travel_writer` - Sensory, immediate, present-tense
- `food_enthusiast` - Ingredient-focused, technique-aware
- `religious_scholar` - Contemplative, historical context
- `sailor` - Maritime, tidal, coastal life
- `historian` - Layered time, deep continuity

**Revision loop:**
- If verdict is `REVISE`, Pass 3.5 improves the candidate with specific feedback
- Revised candidate goes back through Pass 3 critique

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
    pass2_verify.js                 # Pass 2: Verification
    create_test_sample.js           # Helper: Creates 20-sample test set

  /prompts
    research.txt                    # Pass 1 prompt template
    verify_url.txt                  # Pass 2A prompt (URL verification)
    verify_nonurl.txt               # Pass 2B prompt (non-URL verification)

  /data
    /01-research                    # Pass 1 output (raw candidates)
    /02-verified                    # Pass 2 output (verified candidates)
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

### Pass 2: Verify Sources

**Create test sample (20 diverse candidates):**
```bash
node scripts/create_test_sample.js
```

**Run verification:**
```bash
node --env-file=../overt-tourism/server/.env scripts/pass2_verify.js
```

Processes all JSON files in `data/01-research/`, outputs to `data/02-verified/` or `data/99-killed/`.

**Review results:**
- Check survival rate (target: 60-75%)
- Review candidates flagged for human check
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
| 2A | URL verification | Haiku 4.5 | Pure comprehension on supplied text |
| 2B | Non-URL verification | Sonnet 4.6 | Knowledge check; Haiku misses fabrications |
| 3 | Quality critique | Sonnet 4.6 (or Opus) | Editorial judgment |
| 3.5 | Revision | Sonnet 4.6 | Same as Pass 3 for consistency |
| 4 | Voice enrichment | Sonnet 4.6 → Opus 4.7 | Output quality matters most |

**Cost projection (for 500 candidates through full pipeline):**
- Pass 1 (500 candidates): ~$25
- Pass 2 (500 verifications): ~$8
- Pass 3 (350 survivors): ~$10
- Pass 3.5 (50 revisions): ~$1.50
- Pass 4 (150 enrichments, Sonnet): ~$5

**Total:** ~$50-60 with Sonnet-heavy stack, ~$100-150 if using Opus for Pass 4.

---

## Quality Gates

### After Pass 1 (Research)
✅ **Done** - 355 candidates generated

**Review:** Manually check 5-10 samples for:
- Are experiences specific and distinctive?
- Are sources cited properly?
- Is there good geographic/domain diversity?

### After Pass 2 (Verification)
🏗️ **In Testing** - 20 samples running

**Gate:** Don't proceed to Pass 3 until:
- Survival rate is 60-75% (if <50%, tune Pass 1 prompt)
- Spot-check 5 verdicts manually - are they accurate?
- Review "needs human check" flags

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
2. 🏗️ Run Pass 2 verification
3. ⏳ Measure survival rate
4. ⏳ Tune prompts if needed (target: 60-75% survival)

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

### Why 4 Passes Instead of 1?

**Pass 1 alone produces:**
- High volume (~80% of candidates meet surface criteria)
- But: ~40% have fabricated/wrong citations
- And: ~30% of verified candidates are boring-but-true
- Result: Only ~40% are actually shippable

**Full pipeline produces:**
- Lower volume (~40-60% survive all passes)
- But: Every survivor is verified, interesting, and written in voice
- Result: Ship-ready content

The pipeline trades quantity for quality and automation.

### Why Non-URL Sources Are Higher Risk?

URLs can be fetched and checked. Books/articles cannot (without access to full text).

The model can fabricate:
- Specific page numbers that sound authoritative
- Essay titles in named anthologies
- Article publication dates
- Documentary episode numbers

**Mitigation:**
- Use Sonnet 4.6 for Pass 2B (better at spotting implausible sources)
- Flag obscure sources for human review
- Monthly source audit on "source_recognized: false" cases

---

## Current Status

### Completed
- ✅ Pass 1: Generated 355 experiences across 12 countries
- ✅ Pass 2: Built verification system (2A: URL, 2B: Non-URL)
- ✅ Test infrastructure: 20-sample test set, directory structure

### In Progress
- 🏗️ Pass 2 validation: Running on 20 test samples to measure survival rate

### Next Steps
1. Review Pass 2 results, tune if needed
2. Build Pass 3 (quality critic with writer persona tagging)
3. Test Pass 3 on Pass 2 survivors
4. Scale: Run all 355 through Pass 2 → Pass 3
5. Build Pass 4 (voice enrichment with 5 persona templates)

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

### Pass 2 Output (Verified)
```json
{
  // ... all Pass 1 fields ...
  "pass2_verified": true,
  "pass2_verdict": "PLAUSIBLE",
  "pass2_verification": {
    "source_recognized": true,
    "topic_match": "strong",
    "specificity": "high",
    "needs_human_check": false
  }
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

## Related Projects

This is a standalone experiment in the `/exp` directory, separate from but related to:

- **overt-tourism** - iOS app + Node.js/Hono backend for travel catalog browsing
- **MovieGenius** - Movie discovery app with Claude-enriched content

The pipeline developed here may eventually feed content into overt-tourism's catalog.

---

## References

The 4-pass pipeline design comes from a conversation about building scalable, verifiable content generation systems. Key insights:

- **Pass 1 (Research):** Use explicit "fewer is fine" instruction to prevent padding
- **Pass 2 (Verification):** Most critical pass - fabrications caught here prevent credibility loss
- **Pass 3 (Quality):** Adversarial critic does most quality work; boring candidates die here
- **Pass 4 (Enrichment):** Output quality matters most - worth spending on Opus if needed

---

## License

ISC

## Author

Josh Petersen
