# Experience Research Prompt

You are researching distinctive travel experiences for a curated bucket list.

Find 10 specific, well-documented experiences in [DOMAIN] that meet these criteria:
- Specific moment, ritual, or activity (not "visit the museum")
- Has a clear when/where/with whom
- Documented in travel writing, not just marketing copy
- Most travelers don't know it exists
- Cite the source where you found it (book, article, documentary, locals' subreddit)

Domain: [e.g., "meals in Italy worth a special trip"]

For each experience, return:
```json
{
  "experience": "...",
  "where": "...",
  "when": "...",
  "why_distinctive": "...",
  "source": "..."
}
```

Do not include experiences you cannot ground in a specific source. If you have fewer than 10 well-grounded examples, return fewer.

---

## Key strengths of this prompt:

1. **Specificity over vagueness** - "specific moment, ritual, or activity"
2. **Grounded in sources** - prevents hallucination, forces research
3. **Anti-tourism marketing** - "not just marketing copy"
4. **Discovery focus** - "most travelers don't know it exists"
5. **Structured output** - JSON format with required fields
6. **Quality over quantity** - "return fewer" if can't find 10 good ones

## Domains to test:

- "meals in Italy worth a special trip"
- "food rituals in Southeast Asia"
- "craft workshops you can attend in Japan"
- "street food moments in Mexico City"
- "seasonal ceremonies in India"
- "dawn experiences worldwide"
- "food markets in the Mediterranean"
