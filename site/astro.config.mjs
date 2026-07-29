import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://HannsNk.github.io',
  base: '/casual-generosity-astro/',
  build: {
    format: 'file',
    inlineStylesheets: 'always',
  },
  image: {
    domains: ['images.pexels.com', 'images.unsplash.com'],
  },
});