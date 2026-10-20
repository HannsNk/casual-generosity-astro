import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const SITE = 'https://casuallygenerous.com';

// Pages that shouldn't be indexed: redirect stubs, the signed-in profile
// page, and the 404.
const EXCLUDED = [/\/go\//, /\/profile/, /\/404/];

export default defineConfig({
  site: SITE,
  base: '/',
  build: {
    format: 'file',
    inlineStylesheets: 'always',
  },
  image: {
    domains: ['images.pexels.com', 'images.unsplash.com'],
  },
  integrations: [
    sitemap({
      filter: (page) => !EXCLUDED.some((re) => re.test(page)),
      // build.format 'file' emits about.html etc., and every internal link
      // points at the .html path — list the same URLs in the sitemap.
      serialize(item) {
        const url = new URL(item.url);
        if (url.pathname !== '/' && !url.pathname.endsWith('.html')) {
          url.pathname = url.pathname.replace(/\/$/, '') + '.html';
        }
        item.url = url.href;
        return item;
      },
    }),
  ],
});
