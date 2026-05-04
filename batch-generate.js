import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const DOMAIN = "Italian food and ritual experiences";
const BATCHES = 5;
const PER_BATCH = 10;

// Simple location-based deduplication
function deduplicate(experiences) {
  const seen = new Set();
  const unique = [];

  for (const exp of experiences) {
    // Create fingerprint from first 100 chars of experience + location
    const fingerprint = `${exp.experience.substring(0, 100)}||${exp.where}`.toLowerCase();

    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      unique.push(exp);
    } else {
      console.log(`  [SKIP DUPLICATE] ${exp.experience.substring(0, 60)}...`);
    }
  }

  return unique;
}

async function generateBatch(batchNum, exclusions) {
  console.log(`\n🔄 Batch ${batchNum}/${BATCHES}...`);

  const exclusionText = exclusions.length > 0
    ? `\n\nDo not include experiences similar to these already found:\n${exclusions.map(e => `- ${e.experience.substring(0, 80)}... in ${e.where.split(',')[0]}`).join('\n')}\n`
    : '';

  const prompt = `You are researching distinctive travel experiences for a curated bucket list.

Find ${PER_BATCH} specific, well-documented experiences in ${DOMAIN} that meet these criteria:
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
      console.error('  ❌ No JSON found in response');
      return [];
    }

    const experiences = JSON.parse(jsonMatch[1]);
    console.log(`  ✅ Generated ${experiences.length} experiences`);
    return experiences;

  } catch (error) {
    console.error(`  ❌ Batch ${batchNum} failed:`, error.message);
    return [];
  }
}

async function main() {
  console.log(`🚀 Starting batch generation: ${BATCHES} batches × ${PER_BATCH} experiences = ${BATCHES * PER_BATCH} target\n`);

  const allExperiences = [];

  for (let i = 1; i <= BATCHES; i++) {
    const batch = await generateBatch(i, allExperiences);
    allExperiences.push(...batch);

    // Small delay to avoid rate limits
    if (i < BATCHES) {
      console.log('  ⏳ Waiting 2s...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n📊 Total before deduplication: ${allExperiences.length}`);

  const unique = deduplicate(allExperiences);

  console.log(`📊 Total after deduplication: ${unique.length}`);
  console.log(`\n💾 Saving to italian-experiences-50.json...`);

  await fs.writeFile(
    'italian-experiences-50.json',
    JSON.stringify(unique, null, 2)
  );

  console.log(`✅ Done! Generated ${unique.length} unique Italian experiences.\n`);
}

main();
