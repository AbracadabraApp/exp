import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const prompt = `You are researching distinctive travel experiences for a curated bucket list.

Find 10 specific, well-documented experiences in Italian food and ritual experiences that meet these criteria:
- Specific moment, ritual, or activity (not "visit the museum")
- Has a clear when/where/with whom
- Documented in travel writing, not just marketing copy
- Most travelers don't know it exists
- Cite the source where you found it (book, article, documentary, locals' subreddit)

For each experience, return:
{
  "experience": "...",
  "where": "...",
  "when": "...",
  "why_distinctive": "...",
  "source": "..."
}

Do not include experiences you cannot ground in a specific source. If you have fewer than 10 well-grounded examples, return fewer.

Return as a valid JSON array.`;

const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4000,
  messages: [{ role: 'user', content: prompt }]
});

const text = message.content[0].text;
console.log(text);
