// /go/{slug} short alias: hop straight on to the destination baked into
// <html data-dest> at build time. replace() keeps the alias out of history,
// so Back from the landing page doesn't bounce through it again.
const dest = document.documentElement.dataset.dest;
if (dest) location.replace(dest);
