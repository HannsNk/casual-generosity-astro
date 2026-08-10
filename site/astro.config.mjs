import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://casuallygenerous.com',
  base: '/',
  build: {
    format: 'file',
    inlineStylesheets: 'always',
  },
  image: {
    domains: ['images.pexels.com', 'images.unsplash.com'],
  },
});
