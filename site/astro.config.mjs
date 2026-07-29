import { defineConfig } from 'astro/config';

export default defineConfig({
  // 'file' emits /slug.html instead of /slug/index.html, so the built site
  // can be opened straight from disk without a web server.
  build: {
    format: 'file',
    inlineStylesheets: 'always',
  },
  // Remote images from Pexels / Unsplash are used as-is.
  image: {
    domains: ['images.pexels.com', 'images.unsplash.com'],
  },
});
