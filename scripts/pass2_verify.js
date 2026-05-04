import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const INPUT_DIR = 'data/01-research';
const OUTPUT_DIR = 'data/02-verified';
const KILLED_DIR = 'data/99-killed';

// Load prompt templates
const urlPrompt = await fs.readFile('prompts/verify_url.txt', 'utf-8');
const nonUrlPrompt = await fs.readFile('prompts/verify_nonurl.txt', 'utf-8');

// Simple URL detection
function isURL(source) {
  return source.match(/^https?:\/\//i) || source.includes('www.');
}

// Fetch URL content (basic implementation)
async function fetchURL(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BucketListBot/1.0)'
      }
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}`, content: null };
    }

    const html = await response.text();

    // Basic HTML to text conversion (strip tags)
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 10000); // Limit to 10K chars

    return { error: null, content: text };
  } catch (error) {
    return { error: error.message, content: null };
  }
}

// Verify URL-based source (Pass 2A)
async function verifyURL(candidate, pageContent) {
  const prompt = urlPrompt
    .replace('{experience}', candidate.experience)
    .replace('{where}', candidate.where)
    .replace('{when}', candidate.when)
    .replace('{why_distinctive}', candidate.why_distinctive)
    .replace('{source}', candidate.source)
    .replace('{page_content}', pageContent);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]+\}/);

  if (!jsonMatch) {
    throw new Error('No JSON found in verification response');
  }

  return JSON.parse(jsonMatch[0]);
}

// Verify non-URL source (Pass 2B)
async function verifyNonURL(candidate) {
  const prompt = nonUrlPrompt
    .replace('{experience}', candidate.experience)
    .replace('{where}', candidate.where)
    .replace('{when}', candidate.when)
    .replace('{source}', candidate.source);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]+\}/);

  if (!jsonMatch) {
    throw new Error('No JSON found in verification response');
  }

  return JSON.parse(jsonMatch[0]);
}

// Main verification logic
async function verifyCandidate(candidate) {
  console.log(`\n  Verifying: ${candidate.experience.substring(0, 60)}...`);

  // Check if source is a URL
  const hasURL = isURL(candidate.source);

  if (hasURL) {
    // Pass 2A: URL verification
    console.log(`    → URL source detected`);

    const { error, content } = await fetchURL(candidate.source);

    if (error) {
      console.log(`    ✗ Failed to fetch URL: ${error}`);
      return {
        pass: false,
        reason: `url_fetch_failed: ${error}`,
        verification: null
      };
    }

    const verification = await verifyURL(candidate, content);
    console.log(`    → ${verification.verdict} (${verification.confidence})`);

    // Pass criteria for URL sources
    const pass = ['VERIFIED', 'PARTIALLY_VERIFIED'].includes(verification.verdict);

    return {
      pass,
      reason: pass ? null : verification.verdict.toLowerCase(),
      verification
    };

  } else {
    // Pass 2B: Non-URL verification
    console.log(`    → Non-URL source (book/article/etc)`);

    const verification = await verifyNonURL(candidate);
    console.log(`    → ${verification.verdict}${verification.needs_human_check ? ' [NEEDS HUMAN CHECK]' : ''}`);

    // Pass criteria for non-URL sources
    const pass = verification.verdict === 'PLAUSIBLE';

    return {
      pass,
      reason: pass ? null : verification.verdict.toLowerCase(),
      verification
    };
  }
}

// Process all candidates
async function main() {
  console.log('🔍 Pass 2: Verification\n');

  // Read all JSON files from input directory
  const files = await fs.readdir(INPUT_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  console.log(`Found ${jsonFiles.length} candidates to verify\n`);

  let verified = 0;
  let killed = 0;
  const humanCheckList = [];

  for (const filename of jsonFiles) {
    const filepath = path.join(INPUT_DIR, filename);
    const candidate = JSON.parse(await fs.readFile(filepath, 'utf-8'));

    try {
      const result = await verifyCandidate(candidate);

      // Add verification metadata
      candidate.pass2_verified = result.pass;
      candidate.pass2_verdict = result.verification?.verdict || result.reason;
      candidate.pass2_verification = result.verification;
      candidate.pass2_timestamp = new Date().toISOString();

      if (result.pass) {
        // Save to verified directory
        await fs.writeFile(
          path.join(OUTPUT_DIR, filename),
          JSON.stringify(candidate, null, 2)
        );
        verified++;

        // Flag for human check if needed
        if (result.verification?.needs_human_check) {
          humanCheckList.push({
            file: filename,
            experience: candidate.experience.substring(0, 60),
            source: candidate.source,
            concerns: result.verification.concerns
          });
        }
      } else {
        // Save to killed directory
        candidate.killed_at_pass = 'pass2';
        candidate.kill_reason = result.reason;
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
  console.log(`  Verified: ${verified} (${Math.round(verified / jsonFiles.length * 100)}%)`);
  console.log(`  Killed:   ${killed} (${Math.round(killed / jsonFiles.length * 100)}%)`);

  if (humanCheckList.length > 0) {
    console.log(`\n  ⚠️  ${humanCheckList.length} candidates need human check:`);
    humanCheckList.forEach(item => {
      console.log(`    - ${item.experience}...`);
      console.log(`      Source: ${item.source}`);
      console.log(`      Concern: ${item.concerns}\n`);
    });
  }

  console.log(`\n  Verified candidates in: ${OUTPUT_DIR}/`);
  console.log(`  Killed candidates in: ${KILLED_DIR}/\n`);
}

main();
