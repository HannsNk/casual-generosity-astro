// Generates Instagram posts (PNGs + captions) from activities.json and plan.json.
//
//   npm run social                     → every post in plan.json
//   npm run social -- --only=2026-11   → posts whose date starts with 2026-11
//   npm run social -- --data=path.json → use a different activities file
//
// Output: social-out/<date>_<type>_<slug>/01.png… + caption.txt, plus social-out/schedule.md

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { page as buildPage, SIZES } from './templates.mjs';

const ROOT = process.cwd();
const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const DATA = arg('data', 'src/data/activities.json');
const PLAN = arg('plan', 'scripts/social/plan.json');
const OUT = arg('out', 'social-out');
const ONLY = arg('only', '');

const nm = (pkg, file) => pathToFileURL(path.join(ROOT, 'node_modules', pkg, 'files', file)).href;
const fonts = {
  bri: nm('@fontsource/bricolage-grotesque', 'bricolage-grotesque-latin-800-normal.woff2'),
  news: nm('@fontsource/newsreader', 'newsreader-latin-400-normal.woff2'),
  newsItalic: nm('@fontsource/newsreader', 'newsreader-latin-400-italic.woff2'),
  mono: nm('@fontsource/space-mono', 'space-mono-latin-400-normal.woff2'),
  monoBold: nm('@fontsource/space-mono', 'space-mono-latin-700-normal.woff2'),
};

const activities = JSON.parse(await fs.readFile(path.join(ROOT, DATA), 'utf8'));
const plan = JSON.parse(await fs.readFile(path.join(ROOT, PLAN), 'utf8'));
const bySlug = new Map(activities.map(a => [a.slug, a]));
const get = slug => {
  const a = bySlug.get(slug);
  if (!a) throw new Error(`Activity "${slug}" not found in ${DATA}. Check the slug in plan.json.`);
  return a;
};
// Ask Pexels' CDN for a right-sized crop; leave other URLs untouched.
const img = url => (url && url.includes('images.pexels.com') ? `${url.split('?')[0]}?auto=compress&cs=tinysrgb&w=1000&h=667&fit=crop` : url);

// Turn one plan entry into an ordered list of [templateKind, data] slides.
function slidesFor(p) {
  if (p.type === 'card') {
    const a = get(p.slug);
    return [['card', { tier: a.tier, title: a.title, hook: p.hook ?? a.hook, image: img(a.image) }]];
  }
  if (p.type === 'carousel') {
    const a = get(p.slug);
    const n = 5, pg = i => `${i}/${n}`;
    return [
      ['hook', { tier: a.tier, kicker: p.kicker, text: p.hook }],
      ['card', { tier: a.tier, title: a.title, hook: a.hook, image: img(a.image), page: pg(2) }],
      ['steps', { tier: a.tier, title: a.title, steps: p.steps, page: pg(3) }],
      ['why', { tier: a.tier, text: p.why, page: pg(4) }],
      ['cta', { tier: a.tier, page: pg(5) }],
    ];
  }
  if (p.type === 'instead') {
    const a = get(p.slug);
    return [['instead', { tier: a.tier, x: p.x, y: p.y ?? a.title, note: p.note ?? a.hook }]];
  }
  if (p.type === 'roundup') {
    return [['roundup', { kicker: p.kicker, title: p.title, items: p.slugs.map(s => { const a = get(s); return { tier: a.tier, title: a.title }; }) }]];
  }
  if (p.type === 'intro') {
    const n = 4, pg = i => `${i}/${n}`;
    return [['introCover', {}], ['introPlans', { page: pg(2) }], ['introTiers', { page: pg(3) }], ['introCta', { page: pg(4) }]];
  }
  if (p.type === 'stories') {
    return [...p.frames.map(f => ['story', f]), ...(p.covers ?? []).map(c => ['cover', c])];
  }
  throw new Error(`Unknown post type "${p.type}"`);
}

// Skips any tag the caption already uses inline, so #CasuallyGenerous never appears twice.
const tags = p => [...(plan.defaultTags ?? []), ...(p.tags ?? [])]
  .filter(t => !(p.caption ?? '').includes(t))
  .join(' ');
const posts = plan.posts.filter(p => !ONLY || p.date.startsWith(ONLY) || p.id === ONLY);
await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
const schedule = ['# Instagram schedule', '', '| Date | Time | Type | Post | Folder |', '|---|---|---|---|---|'];

for (const p of posts) {
  const slides = slidesFor(p);
  const folder = `${p.date}_${p.type}_${p.slug ?? p.id}`;  // e.g. 2026-10-27_carousel_<slug>
  const dir = path.join(OUT, folder);
  await fs.mkdir(dir, { recursive: true });
  for (const [i, [kind, data]] of slides.entries()) {
    const file = path.join(dir, `_slide.html`);
    const [w, h] = SIZES[kind] ?? [1080, 1350];
    await tab.setViewportSize({ width: w, height: h });
    await fs.writeFile(file, buildPage(kind, data, fonts));
    await tab.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'networkidle' });
    await tab.evaluate(async () => { await document.fonts.ready; window.__fit(); });
    await tab.screenshot({ path: path.join(dir, `${String(i + 1).padStart(2, '0')}.png`) });
    await fs.rm(file);
  }
  if (p.caption) await fs.writeFile(path.join(dir, 'caption.txt'), `${p.caption.trim()}\n\n${tags(p)}\n`);
  schedule.push(`| ${p.date} (${p.day}) | ${p.time} | ${p.type} | ${p.label} | \`${folder}\` |`);
  console.log(`✓ ${folder} (${slides.length} slide${slides.length > 1 ? 's' : ''})`);
}

await fs.writeFile(path.join(OUT, 'schedule.md'), schedule.join('\n') + '\n');
await browser.close();
console.log(`\nDone → ${OUT}/ (${posts.length} posts)`);
