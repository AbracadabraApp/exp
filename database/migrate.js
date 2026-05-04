#!/usr/bin/env node
// database/migrate.js - Run database migrations

import { readFile } from 'fs/promises';
import { readdir } from 'fs/promises';
import { getPool, closePool } from '../lib/db.js';

/**
 * Get list of migration files in order
 */
async function getMigrationFiles() {
  const files = await readdir('./database/migrations');
  return files
    .filter(f => f.endsWith('.sql'))
    .sort(); // Migrations run in alphabetical order (001, 002, etc.)
}

/**
 * Get applied migrations from database
 */
async function getAppliedMigrations() {
  const pool = getPool();

  // Check if schema_migrations table exists
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'schema_migrations'
    );
  `);

  if (!tableCheck.rows[0].exists) {
    return [];
  }

  const result = await pool.query(
    'SELECT version FROM schema_migrations ORDER BY version'
  );

  return result.rows.map(r => r.version);
}

/**
 * Run a migration file
 */
async function runMigration(filename) {
  const pool = getPool();
  const sql = await readFile(`./database/migrations/${filename}`, 'utf-8');

  console.log(`Running migration: ${filename}`);

  try {
    await pool.query(sql);
    console.log(`✅ ${filename} applied successfully`);
  } catch (error) {
    console.error(`❌ ${filename} failed:`, error.message);
    throw error;
  }
}

/**
 * Extract migration version from filename
 */
function extractVersion(filename) {
  const match = filename.match(/^(\d+)_/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Main migration runner
 */
async function migrate() {
  try {
    console.log('🔄 Starting database migration...\n');

    const migrationFiles = await getMigrationFiles();
    const appliedVersions = await getAppliedMigrations();

    console.log(`Found ${migrationFiles.length} migration file(s)`);
    console.log(`${appliedVersions.length} migration(s) already applied\n`);

    let newMigrations = 0;

    for (const filename of migrationFiles) {
      const version = extractVersion(filename);

      if (version === null) {
        console.warn(`⚠️  Skipping ${filename} - invalid format`);
        continue;
      }

      if (appliedVersions.includes(version)) {
        console.log(`⏭️  Skipping ${filename} - already applied`);
        continue;
      }

      await runMigration(filename);
      newMigrations++;
    }

    console.log('\n✅ Migration complete!');
    console.log(`Applied ${newMigrations} new migration(s)`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  }
}

/**
 * Show migration status
 */
async function status() {
  try {
    console.log('📊 Migration Status\n');

    const migrationFiles = await getMigrationFiles();
    const appliedVersions = await getAppliedMigrations();

    console.log('Available migrations:');
    for (const filename of migrationFiles) {
      const version = extractVersion(filename);
      const applied = appliedVersions.includes(version);
      const status = applied ? '✅' : '⏳';
      console.log(`  ${status} ${filename}`);
    }

    console.log(`\nTotal: ${migrationFiles.length} available, ${appliedVersions.length} applied`);

  } catch (error) {
    console.error('❌ Status check failed:', error.message);
    throw error;
  }
}

// CLI
const command = process.argv[2];

if (!command || command === '--help') {
  console.log(`
Usage: node database/migrate.js <command>

Commands:
  up        Run pending migrations
  status    Show migration status
  --help    Show this help

Examples:
  node database/migrate.js up
  node database/migrate.js status
  `);
  process.exit(0);
}

const commands = {
  up: migrate,
  status: status,
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
