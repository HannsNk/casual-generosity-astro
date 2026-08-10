// Pexels serves full-resolution originals by default (up to 6000x4000px).
// Rewrite to request an appropriately sized version via Pexels' documented
// image params instead of shipping the untouched original. Other hosts
// (e.g. Unsplash) are passed through unchanged.
export function resizePexelsUrl(url, width, height) {
  if (!url) return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.hostname !== "images.pexels.com") return url;

  parsed.searchParams.set("auto", "compress");
  parsed.searchParams.set("cs", "tinysrgb");
  // fit=crop is required to get back exactly w x h: without it, Pexels
  // (imgix) fits the source *within* the box preserving aspect ratio, so
  // portrait-oriented photos come back narrower than requested - which
  // then gets upscaled and blurry under the site's object-fit: cover CSS.
  parsed.searchParams.set("fit", "crop");
  parsed.searchParams.set("w", String(width));
  parsed.searchParams.set("h", String(height));
  return parsed.toString();
}
