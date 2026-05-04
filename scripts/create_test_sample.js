import fs from 'fs/promises';
import path from 'path';

// Select 20 diverse candidates for testing Pass 2
async function selectTestSample() {
  const countries = {
    'italian-experiences-50.json': { take: 5, name: 'Italy' },
    'mexico-experiences.json': { take: 5, name: 'Mexico' },
    'france-experiences.json': { take: 5, name: 'France' },
    'china-experiences.json': { take: 3, name: 'China' },
    'thailand-experiences.json': { take: 2, name: 'Thailand' }
  };

  const selected = [];

  for (const [filename, config] of Object.entries(countries)) {
    const filepath = path.join(filename);

    try {
      const data = JSON.parse(await fs.readFile(filepath, 'utf-8'));

      // Take first N experiences from each country
      const candidates = data.slice(0, config.take);

      candidates.forEach((candidate, idx) => {
        // Add ID and country
        candidate.id = `${config.name.toLowerCase()}-${idx + 1}`;
        candidate.country = config.name;
        selected.push(candidate);
      });

      console.log(`✓ Selected ${candidates.length} from ${config.name}`);
    } catch (error) {
      console.log(`✗ Could not read ${filename}: ${error.message}`);
    }
  }

  // Create data/01-research directory if it doesn't exist
  await fs.mkdir('data/01-research', { recursive: true });

  // Save each candidate as individual JSON file in 01-research
  for (const candidate of selected) {
    const filename = `${candidate.id}.json`;
    await fs.writeFile(
      path.join('data/01-research', filename),
      JSON.stringify(candidate, null, 2)
    );
  }

  console.log(`\n✅ Created ${selected.length} test samples in data/01-research/`);
  console.log(`\nReady to run: node --env-file=../overt-tourism/server/.env scripts/pass2_verify.js\n`);
}

selectTestSample();
