#!/usr/bin/env node
// database/seed.js - Import JSON data into cards database
// Flexible: handles Pass 4 output, manual edits, or simplified format

import { readFile } from 'fs/promises';
import { CardsService } from '../lib/cards.js';
import { closePool } from '../lib/db.js';

/**
 * Normalize JSON input to card schema
 * Handles multiple input formats gracefully
 */
function normalizeCardData(input) {
  const card = {};

  // Required field
  card.headline = input.headline || input.experience || input.title;
  if (!card.headline) {
    throw new Error('Missing headline/experience/title field');
  }

  // Content fields
  if (input.subhead) card.subhead = input.subhead;
  if (input.body || input.full_entry) {
    card.body = input.body || input.full_entry;
  }

  // Image handling
  if (input.cover_image_url) {
    card.cover_image_url = input.cover_image_url;
  }

  // Experience-card fields
  if (input.where || input.where_country) {
    // Parse "where" if it's a combined string
    if (input.where && typeof input.where === 'string') {
      // Example: "Alba, Piedmont, Italy"
      const parts = input.where.split(',').map(s => s.trim());
      if (parts.length >= 3) {
        card.where_city = parts[0];
        card.where_region = parts[1];
        card.where_country = parts[2].toLowerCase().replace(/\s+/g, '_');
      } else if (parts.length === 2) {
        card.where_region = parts[0];
        card.where_country = parts[1].toLowerCase().replace(/\s+/g, '_');
      } else {
        card.where_country = parts[0].toLowerCase().replace(/\s+/g, '_');
      }
    } else {
      // Structured location fields
      if (input.where_country) card.where_country = input.where_country;
      if (input.where_region) card.where_region = input.where_region;
      if (input.where_city) card.where_city = input.where_city;
    }
  }

  if (input.lat) card.lat = input.lat;
  if (input.lng) card.lng = input.lng;
  if (input.place_id) card.place_id = input.place_id;

  // Timing fields
  if (input.when_season) card.when_season = input.when_season;
  if (input.when_time_of_day) card.when_time_of_day = input.when_time_of_day;
  if (input.when_specific_date) card.when_specific_date = input.when_specific_date;

  // Parse "when" if provided as combined string
  if (input.when && typeof input.when === 'string') {
    // Example: "October–November, Saturday and Sunday mornings, 6–7am"
    const whenLower = input.when.toLowerCase();

    // Detect season
    if (whenLower.includes('spring')) card.when_season = 'spring';
    else if (whenLower.includes('summer')) card.when_season = 'summer';
    else if (whenLower.includes('autumn') || whenLower.includes('fall')) card.when_season = 'autumn';
    else if (whenLower.includes('winter')) card.when_season = 'winter';

    // Detect time of day
    if (whenLower.includes('pre-dawn') || whenLower.includes('predawn')) {
      card.when_time_of_day = 'pre_dawn';
    } else if (whenLower.includes('dawn')) {
      card.when_time_of_day = 'dawn';
    } else if (whenLower.includes('morning')) {
      card.when_time_of_day = 'morning';
    } else if (whenLower.includes('midday') || whenLower.includes('noon')) {
      card.when_time_of_day = 'midday';
    } else if (whenLower.includes('afternoon')) {
      card.when_time_of_day = 'afternoon';
    } else if (whenLower.includes('evening')) {
      card.when_time_of_day = 'evening';
    } else if (whenLower.includes('dusk') || whenLower.includes('sunset')) {
      card.when_time_of_day = 'dusk';
    } else if (whenLower.includes('night')) {
      card.when_time_of_day = 'night';
    }
  }

  // Source/citation
  if (input.source) card.source = input.source;
  if (input.source_type) card.source_type = input.source_type;

  // Detect source type from source string if not provided
  if (input.source && !input.source_type) {
    if (input.source.startsWith('http')) {
      card.source_type = 'url';
    } else if (input.source.includes('pp.') || input.source.includes('p.')) {
      card.source_type = 'book';
    } else if (input.source.includes('documentary')) {
      card.source_type = 'documentary';
    } else {
      card.source_type = 'article';
    }
  }

  if (input.sensory_anchor) card.sensory_anchor = input.sensory_anchor;

  // List-card fields
  if (input.member_card_ids) {
    card.member_card_ids = input.member_card_ids;
  }
  if (input.curator_notes) {
    card.curator_notes = input.curator_notes;
  }

  // Metadata
  if (input.themes) {
    card.themes = Array.isArray(input.themes) ? input.themes : [input.themes];
  }

  card.status = input.status || 'draft';

  if (input.prompt_version || input.pass4_prompt_version) {
    card.prompt_version = input.prompt_version || input.pass4_prompt_version;
  }

  if (input.generated_by || input.pass4_model) {
    card.generated_by = input.generated_by || input.pass4_model;
  }

  return card;
}

/**
 * Import cards from JSON file
 */
async function importCards(jsonPath, options = {}) {
  const { dryRun = false, skipDuplicates = true } = options;

  try {
    console.log(`📖 Reading ${jsonPath}...`);
    const content = await readFile(jsonPath, 'utf-8');
    const data = JSON.parse(content);

    // Handle both array and object with cards array
    const items = Array.isArray(data) ? data : data.cards || data.experiences || [data];

    console.log(`Found ${items.length} items to import`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const [index, item] of items.entries()) {
      try {
        const card = normalizeCardData(item);

        if (dryRun) {
          console.log(`\n[${index + 1}] Would import:`, {
            headline: card.headline,
            country: card.where_country,
            status: card.status,
            type: card.member_card_ids ? 'list' : 'experience'
          });
          imported++;
        } else {
          // Check for existing card with same headline (if skipDuplicates)
          if (skipDuplicates) {
            const existing = await CardsService.getCardsByStatus('draft', {});
            const duplicate = existing.find(c => c.headline === card.headline);

            if (duplicate) {
              console.log(`⚠️  [${index + 1}] Skipped duplicate: "${card.headline}"`);
              skipped++;
              continue;
            }
          }

          const created = await CardsService.createCard(card);
          console.log(`✅ [${index + 1}] Imported: "${created.headline}" (${created.id})`);
          imported++;
        }
      } catch (error) {
        console.error(`❌ [${index + 1}] Error:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`  Imported: ${imported}`);
    console.log(`  Skipped:  ${skipped}`);
    console.log(`  Errors:   ${errors}`);
    console.log(`  Total:    ${items.length}`);

    if (dryRun) {
      console.log('\n⚠️  DRY RUN - no data was written to database');
    }

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    throw error;
  }
}

// CLI usage
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
Usage: node database/seed.js <json-file> [options]

Options:
  --dry-run           Preview import without writing to database
  --allow-duplicates  Import even if headline already exists
  --help              Show this help

Examples:
  node database/seed.js data/04-enriched/italy-50.json
  node database/seed.js data/04-enriched/italy-50.json --dry-run
  node database/seed.js italian-experiences.json --allow-duplicates
  `);
  process.exit(0);
}

const jsonPath = args[0];
const dryRun = args.includes('--dry-run');
const skipDuplicates = !args.includes('--allow-duplicates');

importCards(jsonPath, { dryRun, skipDuplicates })
  .then(() => {
    console.log('✅ Import complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  })
  .finally(() => {
    closePool();
  });
