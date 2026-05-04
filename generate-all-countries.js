import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const COUNTRIES = [
  { name: 'France', domain: 'French food and ritual experiences' },
  { name: 'Spain', domain: 'Spanish food and ritual experiences' },
  { name: 'United States', domain: 'American food and ritual experiences' },
  { name: 'Turkey', domain: 'Turkish food and ritual experiences' },
  { name: 'Mexico', domain: 'Mexican food and ritual experiences' },
  { name: 'Greece', domain: 'Greek food and ritual experiences' },
  { name: 'Japan', domain: 'Japanese food and ritual experiences' },
  { name: 'Austria', domain: 'Austrian food and ritual experiences' },
  { name: 'Thailand', domain: 'Thai food and ritual experiences' },
  { name: 'Germany', domain: 'German food and ritual experiences' },
  { name: 'China', domain: 'Chinese food and ritual experiences' }
];

const TARGET_PER_COUNTRY = 30;
const BATCHES_PER_COUNTRY = 3; // 3 batches × 10 = 30
const PER_BATCH = 10;

// Simple location-based deduplication
function deduplicate(experiences) {
  const seen = new Set();
  const unique = [];

  for (const exp of experiences) {
    const fingerprint = `${exp.experience.substring(0, 100)}||${exp.where}`.toLowerCase();

    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      unique.push(exp);
    } else {
      console.log(`    [SKIP DUPLICATE] ${exp.experience.substring(0, 50)}...`);
    }
  }

  return unique;
}

async function generateBatch(country, domain, batchNum, exclusions) {
  console.log(`  🔄 Batch ${batchNum}/${BATCHES_PER_COUNTRY}...`);

  const exclusionText = exclusions.length > 0
    ? `\n\nDo not include experiences similar to these already found:\n${exclusions.map(e => `- ${e.experience.substring(0, 80)}... in ${e.where.split(',')[0]}`).join('\n')}\n`
    : '';

  const prompt = `You are researching distinctive travel experiences for a curated bucket list.

Find ${PER_BATCH} specific, well-documented experiences in ${domain} that meet these criteria:
- Specific moment, ritual, or activity (not "visit the museum")
- Has a clear when/where/with whom
- Documented in travel writing, not just marketing copy
- Most travelers don't know it exists
- Cite the source where you found it (book, article, documentary, locals' subreddit)
${exclusionText}
For each experience, return:
{
  "experience": "...",
  "where": "...",
  "when": "...",
  "why_distinctive": "...",
  "source": "..."
}

Do not include experiences you cannot ground in a specific source. If you have fewer than ${PER_BATCH} well-grounded examples, return fewer.

Return as a valid JSON array.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = message.content[0].text;

    // Extract JSON (handle markdown code blocks)
    const jsonMatch = text.match(/```json\n([\s\S]+?)\n```/) || text.match(/(\[[\s\S]+\])/);
    if (!jsonMatch) {
      console.error(`    ❌ No JSON found in response`);
      return [];
    }

    const experiences = JSON.parse(jsonMatch[1]);
    console.log(`    ✅ Generated ${experiences.length} experiences`);
    return experiences;

  } catch (error) {
    console.error(`    ❌ Batch ${batchNum} failed:`, error.message);
    return [];
  }
}

async function generateCountry(country, domain) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🌍 ${country.toUpperCase()}`);
  console.log(`${'='.repeat(60)}`);

  const allExperiences = [];

  for (let i = 1; i <= BATCHES_PER_COUNTRY; i++) {
    const batch = await generateBatch(country, domain, i, allExperiences);
    allExperiences.push(...batch);

    // Small delay to avoid rate limits
    if (i < BATCHES_PER_COUNTRY) {
      console.log(`    ⏳ Waiting 2s...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`  📊 Total before deduplication: ${allExperiences.length}`);

  const unique = deduplicate(allExperiences);

  console.log(`  📊 Total after deduplication: ${unique.length}`);

  const filename = `${country.toLowerCase().replace(/\s+/g, '-')}-experiences.json`;
  console.log(`  💾 Saving to ${filename}...`);

  await fs.writeFile(filename, JSON.stringify(unique, null, 2));

  console.log(`  ✅ ${country}: ${unique.length} unique experiences saved\n`);

  return { country, count: unique.length, filename };
}

async function main() {
  console.log(`🚀 Multi-Country Batch Generation`);
  console.log(`📋 Countries: ${COUNTRIES.length}`);
  console.log(`🎯 Target per country: ${TARGET_PER_COUNTRY} experiences`);
  console.log(`📊 Total target: ${COUNTRIES.length * TARGET_PER_COUNTRY} experiences\n`);

  const results = [];

  for (const { name, domain } of COUNTRIES) {
    const result = await generateCountry(name, domain);
    results.push(result);

    // Delay between countries to avoid rate limits
    if (COUNTRIES[COUNTRIES.length - 1].name !== name) {
      console.log(`⏳ Waiting 3s before next country...\n`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ ALL DONE!`);
  console.log(`${'='.repeat(60)}\n`);

  console.log(`Summary:`);
  results.forEach(({ country, count, filename }) => {
    console.log(`  ${country.padEnd(20)} → ${count.toString().padStart(2)} experiences (${filename})`);
  });

  const totalGenerated = results.reduce((sum, r) => sum + r.count, 0);
  console.log(`\n  Total: ${totalGenerated} unique experiences across ${COUNTRIES.length} countries\n`);
}

main();
