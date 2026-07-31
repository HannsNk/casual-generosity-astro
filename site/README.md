# CasuallyGenerous

A directory of small, mostly free things worth doing with the people you're
already seeing — inspired by Chris Anderson's *Infectious Generosity*. Not a
volunteering platform, not a donation platform: the space in between, for
things that fit into a life you're already living rather than a formal
commitment.

Live at **[casuallygenerous](https://hannsnk.github.io/casual-generosity-astro/)**.

## What's here

- **`/`** — a landing page with a few intent-based entry points
- **`/activities/`** — the full directory, filterable by effort, cost, time
  and group size, with a client-side filter bar (~1KB of JS, no framework)
- **`/[slug]`** — one static page per activity, each with a "have you done
  this?" story feed
- **`/notes/`** — an Astro content collection of longer-form posts, written
  in Markdown, each optionally linking back to featured activities
- **`/about/`**, **`/privacy/`** — project pages, including a contact form

Visually it's a "riso noticeboard": flat spot-colour inks, hard offset
shadows, three tier colours (Spontaneous/Planned/Committed). All of that
lives in `src/styles/global.css` as a small set of CSS variables and
reusable classes (`.chip`, `.card`, `.stamp`, `--tier`, `--edge`, …) — see
[Design system](#design-system-if-youre-changing-styles) before adding new
ones.

## Stack

- **[Astro](https://astro.build)** (v5), static output, no UI framework
- **Firebase Firestore** — client-side, for the "did it / want to try"
  stories on each activity page (config in `src/lib/firebase.js`; the API
  key there is a public client key, not a secret — that's normal for
  Firebase web apps)
- **[Formspree](https://formspree.io)** — the contact form on `/about/`
- **Cloudflare Web Analytics** — cookieless, no consent banner needed
- Deployed to **GitHub Pages** via GitHub Actions (`.github/workflows/deploy.yml`)
  on every push to `main`

## Getting started

```bash
cd site
npm install
npm run dev       # http://localhost:4321 — live reload while you edit
```

Other scripts:

```bash
npm run build      # writes the finished, static site to dist/
npm run preview    # serve dist/ locally, close to what production looks like
```

The site is served from a subpath (`/casual-generosity-astro/`, configured
in `astro.config.mjs`), which is why internal links go through
`import.meta.env.BASE_URL` rather than being written as plain `/path`. Keep
that in mind if you add new links — a bare `href="/foo.html"` will 404 once
deployed.

## Where content lives

**Activities** — `src/data/activities.json`, 98 records, one object per
activity (`title`, `hook`, `image`, `tier`, `cost`, `time`, `groupSize`,
`location`, `tags`, `needs`, `why`, `instructions`, `link`). Edit the file
directly; the site picks it up on the next build. No CMS, no API keys.

**Notes** — `src/content/notes/*.md`, an Astro content collection (schema in
`src/content.config.ts`). Frontmatter needs `title`, `date`, optionally
`description` and `featuredActivities` (an array of activity slugs to show
alongside the post):

```md
---
title: "Becoming a plastic-free champion"
date: 2026-07-23
description: "Four small habits that add up to a genuinely different relationship with plastic waste."
featuredActivities:
  - run-a-plastic-free-picnic
---

Your post body in Markdown goes here.
```

Drop a new file in that folder and it shows up on `/notes/` automatically,
newest first.

## Design system (if you're changing styles)

Everything lives in `src/styles/global.css`. Before adding new CSS:

- Reuse the existing variables (`--pink`/`--blue`/`--green` per tier,
  `--ink`, `--paper`, `--edge` for border width, `--display`/`--body`/`--mono`
  for fonts) rather than hardcoding new colours or fonts.
- Reuse existing classes where the pattern already exists — `.chip` for
  toggleable filter-style buttons, `.card` for the hard-shadow tier-coloured
  box treatment, `.stamp` for the small tier label.
- `.wrap` sets the page's horizontal gutter via `padding-inline`. If you add
  an element that combines the `wrap` class with another class on the same
  node, make sure that other class doesn't use the `padding` shorthand (e.g.
  `padding: 2rem 0`) — it'll silently zero out `.wrap`'s side padding. Use
  `padding-block` instead. This has bitten the codebase more than once.

## Known gaps

- Some activities have no photo (`image` is `""`); the card falls back to a
  hatched placeholder.
- No comments on notes posts yet.
- `link` values starting with `Search:` render as plain text rather than a
  clickable link — intentional for now, since there's no single URL to point
  to.

## Contributing

Issues and PRs welcome — this is a small side project, not a company, so
there's no formal process. A few practical notes:

- **New activities**: add an object to `activities.json` following the
  existing shape; `slug` should be a lowercase, hyphenated version of the
  title and needs to be unique.
- **New notes**: add a Markdown file to `src/content/notes/`, following the
  frontmatter shape above.
- **Design changes**: see [Design system](#design-system-if-youre-changing-styles)
  above — the whole site is built from a deliberately small set of tokens
  and reusable classes, so new one-off styles should be a last resort.
- Run `npm run build` before opening a PR — it catches broken content
  (missing frontmatter fields, bad image domains, etc.) that `dev` mode
  won't always surface.

Got an idea, a correction, or just want to say hello? There's a contact form
on [`/about/`](https://hannsnk.github.io/casual-generosity-astro/about.html).
