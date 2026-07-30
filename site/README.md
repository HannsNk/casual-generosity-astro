# CasuallyGenerous

A static directory of 98 activities. Astro, no framework, ~1KB of JavaScript
on the page (the filter bar). Every activity is its own static HTML page.

## Run it

```bash
npm install
npm run dev      # http://localhost:4321 — live reload while you edit
npm run build    # writes the finished site to dist/
```

`dist/` is a plain folder of HTML files. You can open `dist/index.html`
directly in a browser, or drag the whole folder onto Netlify or Cloudflare
Pages to publish it.

## Where the content lives

Right now: `src/data/activities.json` — 98 records, one object each.

Edit that file and the site updates on the next build. That's the simplest
setup and it needs no API keys.

## Wiring it to Airtable

Two ways, depending on how much you want to change.

### Option A — fetch script (simplest)

Keep the site reading `activities.json`, and refresh that file from Airtable
whenever you want. Create `scripts/fetch-airtable.mjs`:

```js
const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE  = process.env.AIRTABLE_BASE_ID;
const TABLE = 'Activities';

const res = await fetch(
  `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}?pageSize=100`,
  { headers: { Authorization: `Bearer ${TOKEN}` } }
);
const { records } = await res.json();

const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const split = (v) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const out = records.map(({ fields: f }) => ({
  slug: slug(f.Title),
  title: f.Title,
  hook: f.Hook,
  image: f['Image URL'] ?? '',
  tier: f.Tier,
  cost: split(f.Cost),
  time: f['Time Needed'],
  timeBucket: bucket(f['Time Needed']),
  groupSize: split(f['Group Size']),
  location: split(f['Location Type']),
  tags: split(f['Category Tags']),
  needs: f['What You Need'] ?? '',
  why: f['Why This Matters'],
  instructions: f.Instructions,
  link: f['Org / Link'] ?? '',
}));

await import('node:fs/promises').then((fs) =>
  fs.writeFile('src/data/activities.json', JSON.stringify(out, null, 1))
);
```

Then `"build": "node scripts/fetch-airtable.mjs && astro build"` in
package.json, and set `AIRTABLE_TOKEN` / `AIRTABLE_BASE_ID` as environment
variables on your host. Every deploy pulls fresh from Airtable.

Note: Airtable pages at 100 records, so once you pass 100 activities you'll
need to follow the `offset` field in the response.

### Option B — Astro Content Layer loader

More idiomatic, gives you schema validation and TypeScript types. Create
`src/content.config.ts`:

```ts
import { defineCollection, z } from 'astro:content';

const activities = defineCollection({
  loader: async () => {
    const res = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Activities`,
      { headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` } }
    );
    const { records } = await res.json();
    return records.map((r) => ({ id: r.id, ...r.fields }));
  },
  schema: z.object({
    Title: z.string(),
    Hook: z.string().max(200),
    Tier: z.enum(['Spontaneous', 'Planned', 'Committed']),
    'Image URL': z.string().url().optional(),
    // ...the rest of your fields
  }),
});

export const collections = { activities };
```

Then swap the `import activities from '../data/activities.json'` lines for
`await getCollection('activities')`. The schema means a bad Tier value or a
missing Title fails the build instead of shipping a broken card.

## Rebuilding when Airtable changes

Content is baked in at build time, so edits in Airtable don't appear until you
rebuild. On Netlify or Cloudflare Pages, create a build hook (a URL), then add
an Airtable automation: *when a record is updated → send webhook → that URL*.
Edit a record, site updates about a minute later.

## Things still to do

- 82 of the 98 activities have no photo. `Image URL` is blank for those and
  the card shows a hatched placeholder.
- Three existing image URLs aren't stock photos and should be replaced
  (the sign-language chart, the Missing Maps infographic, the YouTube thumbnail).
- No comments yet. Giscus is free and drops into the detail page template.
- `Org / Link` values starting with "Search:" render as plain text, not links.
