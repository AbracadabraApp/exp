import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const INPUT_DIR = 'data/01-research';
const OUTPUT_DIR = 'data/02-plausible';
const KILLED_DIR = 'data/99-killed';

// Load prompt template
const plausibilityPrompt = await fs.readFile('prompts/plausibility_check.txt', 'utf-8');

// Check plausibility using Sonnet 4.6
async function checkPlausibility(candidate) {
  const prompt = plausibilityPrompt
    .replace('{experience}', candidate.experience)
    .replace('{where}', candidate.where)
    .replace('{when}', candidate.when)
    .replace('{why_distinctive}', candidate.why_distinctive || '')
    .replace('{source}', candidate.source || '(no source cited)');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });

  let text = response.content[0].text;

  // Remove markdown code blocks if present
  text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  // Find the first { and last } to extract complete JSON
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    console.log(`    ⚠️  Response without JSON: ${text.substring(0, 200)}`);
    throw new Error('No JSON found in plausibility check response');
  }

  const jsonStr = text.substring(firstBrace, lastBrace + 1);
  return JSON.parse(jsonStr);
}

// Process a single candidate
async function processCandidate(candidate) {
  console.log(`\n  Checking: ${candidate.experience.substring(0, 60)}...`);

  const result = await checkPlausibility(candidate);
  console.log(`    → ${result.verdict}`);
  console.log(`    → ${result.reasoning.substring(0, 80)}...`);

  const pass = result.verdict === 'PLAUSIBLE';

  return {
    pass,
    verdict: result.verdict,
    reasoning: result.reasoning
  };
}

// Process all candidates
async function main() {
  console.log('🔍 Pass 2: Plausibility Check\n');

  // Create output directories if they don't exist
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(KILLED_DIR, { recursive: true });

  // Read all JSON files from input directory
  const files = await fs.readdir(INPUT_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  console.log(`Found ${jsonFiles.length} candidates to check\n`);

  let plausible = 0;
  let killed = 0;

  for (const filename of jsonFiles) {
    const filepath = path.join(INPUT_DIR, filename);
    const candidate = JSON.parse(await fs.readFile(filepath, 'utf-8'));

    try {
      const result = await processCandidate(candidate);

      // Add plausibility metadata
      candidate.pass2_plausible = result.pass;
      candidate.pass2_verdict = result.verdict;
      candidate.pass2_reasoning = result.reasoning;
      candidate.pass2_timestamp = new Date().toISOString();

      if (result.pass) {
        // Save to plausible directory
        await fs.writeFile(
          path.join(OUTPUT_DIR, filename),
          JSON.stringify(candidate, null, 2)
        );
        plausible++;
      } else {
        // Save to killed directory
        candidate.killed_at_pass = 'pass2';
        candidate.kill_reason = 'implausible';
        await fs.writeFile(
          path.join(KILLED_DIR, filename),
          JSON.stringify(candidate, null, 2)
        );
        killed++;
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`    ✗ Error: ${error.message}`);
      // Save to killed with error reason
      candidate.killed_at_pass = 'pass2';
      candidate.kill_reason = `error: ${error.message}`;
      await fs.writeFile(
        path.join(KILLED_DIR, filename),
        JSON.stringify(candidate, null, 2)
      );
      killed++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Pass 2 Complete\n`);
  console.log(`  Plausible: ${plausible} (${Math.round(plausible / jsonFiles.length * 100)}%)`);
  console.log(`  Killed:    ${killed} (${Math.round(killed / jsonFiles.length * 100)}%)`);

  const survivalRate = Math.round(plausible / jsonFiles.length * 100);
  if (survivalRate < 70) {
    console.log(`\n  ⚠️  Warning: Survival rate is ${survivalRate}% (target: 75-85%)`);
    console.log(`      Consider tuning the plausibility prompt to be less strict.`);
  } else if (survivalRate > 90) {
    console.log(`\n  ⚠️  Warning: Survival rate is ${survivalRate}% (target: 75-85%)`);
    console.log(`      Consider tuning the plausibility prompt to be more strict.`);
  }

  console.log(`\n  Plausible candidates in: ${OUTPUT_DIR}/`);
  console.log(`  Killed candidates in: ${KILLED_DIR}/\n`);
}

main();
