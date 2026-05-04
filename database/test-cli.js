#!/usr/bin/env node
// database/test-cli.js - Interactive CLI for testing CardsService

import { CardsService } from '../lib/cards.js';
import { closePool } from '../lib/db.js';

/**
 * Test: Create experience-card
 */
async function testCreateExperience() {
  console.log('\n🧪 Test: Create experience-card');

  const card = await CardsService.createCard({
    headline: 'Attend pre-dawn fish auction in Gallipoli',
    subhead: 'Where Pugliese fishermen sell the dawn catch',
    where_country: 'italy',
    where_region: 'Puglia',
    where_city: 'Gallipoli',
    when_season: 'year_round',
    when_time_of_day: 'pre_dawn',
    source: 'Test source',
    source_type: 'article',
    themes: ['morning_rituals', 'markets_at_dawn'],
    status: 'draft',
    prompt_version: '4.0',
    generated_by: 'manual-test',
  });

  console.log('✅ Created experience-card:', {
    id: card.id,
    headline: card.headline,
    country: card.where_country,
  });

  return card;
}

/**
 * Test: Create list-card
 */
async function testCreateList(memberCardIds = []) {
  console.log('\n🧪 Test: Create list-card');

  const card = await CardsService.createCard({
    headline: 'Morning Rituals Worth Waking For',
    subhead: 'Dawn experiences that reward early risers',
    curator_notes: 'A collection of pre-dawn and early morning experiences across the Mediterranean.',
    member_card_ids: memberCardIds,
    themes: ['morning_rituals'],
    status: 'draft',
    prompt_version: '4.0',
    generated_by: 'manual-test',
  });

  console.log('✅ Created list-card:', {
    id: card.id,
    headline: card.headline,
    members: card.member_card_ids.length,
  });

  return card;
}

/**
 * Test: Get cards by IDs (preserves order)
 */
async function testGetCardsByIds(ids) {
  console.log('\n🧪 Test: Get cards by IDs (preserving order)');

  const cards = await CardsService.getCardsByIds(ids);

  console.log(`✅ Retrieved ${cards.length} cards in order:`);
  cards.forEach((card, i) => {
    console.log(`  ${i + 1}. ${card.headline}`);
  });

  return cards;
}

/**
 * Test: Find lists containing card
 */
async function testGetListsContainingCard(cardId) {
  console.log('\n🧪 Test: Find lists containing card');

  const lists = await CardsService.getListsContainingCard(cardId);

  console.log(`✅ Found ${lists.length} list(s) containing this card:`);
  lists.forEach((list) => {
    console.log(`  - ${list.headline} (${list.member_card_ids.length} members)`);
  });

  return lists;
}

/**
 * Test: Add card to list
 */
async function testAddCardToList(listId, cardId) {
  console.log('\n🧪 Test: Add card to list');

  const updated = await CardsService.addCardToList(listId, cardId);

  console.log('✅ Card added to list:', {
    list: updated.headline,
    members: updated.member_card_ids.length,
  });

  return updated;
}

/**
 * Test: Reorder list members
 */
async function testReorderList(listId, newOrder) {
  console.log('\n🧪 Test: Reorder list members');

  const updated = await CardsService.reorderListMembers(listId, newOrder);

  console.log('✅ List reordered:', {
    list: updated.headline,
    newOrder: updated.member_card_ids,
  });

  return updated;
}

/**
 * Test: Update card status
 */
async function testUpdateStatus(cardId, status) {
  console.log(`\n🧪 Test: Update card status to "${status}"`);

  const updated = await CardsService.updateCardStatus(cardId, status);

  console.log('✅ Status updated:', {
    headline: updated.headline,
    status: updated.status,
  });

  return updated;
}

/**
 * Test: Get cards by status with filters
 */
async function testGetCardsByStatus() {
  console.log('\n🧪 Test: Get cards by status');

  const drafts = await CardsService.getCardsByStatus('draft');

  console.log(`✅ Found ${drafts.length} draft cards`);

  if (drafts.length > 0) {
    console.log('  Examples:');
    drafts.slice(0, 3).forEach((card) => {
      const type = card.member_card_ids ? 'list' : 'experience';
      console.log(`  - ${card.headline} (${type})`);
    });
  }

  return drafts;
}

/**
 * Run full test suite
 */
async function runTests() {
  console.log('🚀 Starting CardsService test suite...');

  try {
    // 1. Create experience-cards
    const exp1 = await testCreateExperience();
    const exp2 = await CardsService.createCard({
      headline: 'Visit morning market in Bologna',
      where_country: 'italy',
      where_region: 'Emilia-Romagna',
      where_city: 'Bologna',
      when_time_of_day: 'morning',
      themes: ['morning_rituals', 'markets_at_dawn'],
      status: 'draft',
    });
    console.log(`✅ Created second experience: ${exp2.headline}`);

    // 2. Create list-card with initial members
    const list = await testCreateList([exp1.id, exp2.id]);

    // 3. Test getting cards by IDs
    await testGetCardsByIds([exp1.id, exp2.id]);

    // 4. Test finding lists containing a card
    await testGetListsContainingCard(exp1.id);

    // 5. Create third experience
    const exp3 = await CardsService.createCard({
      headline: 'Dawn at the truffle market in Alba',
      where_country: 'italy',
      where_region: 'Piedmont',
      where_city: 'Alba',
      when_time_of_day: 'dawn',
      themes: ['morning_rituals'],
      status: 'draft',
    });

    // 6. Add third card to list
    await testAddCardToList(list.id, exp3.id);

    // 7. Reorder list members
    await testReorderList(list.id, [exp3.id, exp1.id, exp2.id]);

    // 8. Update status
    await testUpdateStatus(exp1.id, 'ready');
    await testUpdateStatus(list.id, 'ready');

    // 9. Get cards by status
    await testGetCardsByStatus();

    console.log('\n✅ All tests passed!');
    console.log('\n📋 Summary:');
    console.log('  - Created 3 experience-cards');
    console.log('  - Created 1 list-card');
    console.log('  - Tested list membership operations');
    console.log('  - Tested status updates');
    console.log('  - Tested querying by status');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  }
}

// CLI
const command = process.argv[2];

if (command === '--help' || !command) {
  console.log(`
Usage: node database/test-cli.js <command>

Commands:
  run       Run full test suite
  clean     Remove test data (status = 'draft', generated_by = 'manual-test')
  --help    Show this help

Examples:
  node database/test-cli.js run
  node database/test-cli.js clean
  `);
  process.exit(0);
}

const commands = {
  run: runTests,
  clean: async () => {
    console.log('🧹 Cleaning test data...');
    const pool = await import('../lib/db.js').then(m => m.getPool());
    const result = await pool.query(
      "DELETE FROM cards WHERE generated_by = 'manual-test' RETURNING headline"
    );
    console.log(`✅ Deleted ${result.rows.length} test cards`);
    result.rows.forEach((r) => console.log(`  - ${r.headline}`));
  },
};

const fn = commands[command];

if (!fn) {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

fn()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    closePool();
  });
