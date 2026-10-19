// Counts which site or link a visitor arrived from, as one anonymous
// arrivals/{id} doc per landing. Nothing here may touch device storage (no
// cookies, localStorage, sessionStorage or IndexedDB), so it talks to
// Firestore over plain REST rather than the SDK, whose heartbeat writes to
// IndexedDB. No visitor ID or fingerprinting data is ever sent.
import { apiKey, projectId } from '../lib/firebase-config.js';

const MAX_SOURCE = 32;
const MAX_PATH = 120;

const sanitize = (value) => (value ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, MAX_SOURCE);

// Suffix match, so www./l./m./old. subdomains count too.
const onDomain = (host, domain) => host === domain || host.endsWith(`.${domain}`);
// Search engines and Pinterest serve country domains (google.co.uk, google.de…).
const onBrand = (host, name) => new RegExp(`(^|\\.)${name}\\.[a-z]{2,3}(\\.[a-z]{2})?$`).test(host);

const KNOWN_REFERRERS = [
  ['instagram', (h) => onDomain(h, 'instagram.com')],
  ['facebook', (h) => onDomain(h, 'facebook.com')],
  ['reddit', (h) => onDomain(h, 'reddit.com')],
  ['x', (h) => ['t.co', 'x.com', 'twitter.com'].some((d) => onDomain(h, d))],
  ['linkedin', (h) => onDomain(h, 'linkedin.com') || onDomain(h, 'lnkd.in')],
  ['google', (h) => onBrand(h, 'google')],
  ['bing', (h) => onDomain(h, 'bing.com')],
  ['duckduckgo', (h) => onDomain(h, 'duckduckgo.com')],
  ['pinterest', (h) => onBrand(h, 'pinterest') || onDomain(h, 'pin.it')],
  ['whatsapp', (h) => onDomain(h, 'whatsapp.com') || onDomain(h, 'wa.me')],
  ['hn', (h) => h === 'news.ycombinator.com'],
];

const referrerHost = () => {
  try {
    return document.referrer ? new URL(document.referrer).hostname : '';
  } catch {
    return '';
  }
};

const resolveSource = (params, host) => {
  const fromParam = sanitize(params.get('ref')) || sanitize(params.get('utm_source'));
  if (fromParam) return fromParam;
  if (!host) return 'direct';
  return KNOWN_REFERRERS.find(([, matches]) => matches(host))?.[0] ?? 'other-referral';
};

// Strips the attribution params so a reload or a copied link doesn't
// re-attribute. Runs even when we log nothing (GPC, ?internal=1…), since a
// clean URL is better regardless. Other params and the hash are kept.
const cleanAddressBar = (url) => {
  const keys = [...url.searchParams.keys()].filter((k) => k === 'ref' || k.startsWith('utm_'));
  if (!keys.length) return;
  keys.forEach((k) => url.searchParams.delete(k));
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
};

// Same shape as a Firestore auto-ID: 20 chars of [A-Za-z0-9].
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const randomId = () => [...crypto.getRandomValues(new Uint8Array(20))]
  .map((b) => ID_CHARS[b % ID_CHARS.length])
  .join('');

const logArrival = (source, path) => {
  const docName = `projects/${projectId}/databases/(default)/documents/arrivals/${randomId()}`;
  const body = {
    writes: [{
      update: {
        name: docName,
        fields: {
          source: { stringValue: source },
          path: { stringValue: path },
        },
      },
      updateTransforms: [{ fieldPath: 'ts', setToServerValue: 'REQUEST_TIME' }],
      currentDocument: { exists: false },
    }],
  };

  // text/plain keeps this a CORS "simple" request (no preflight round trip);
  // Firestore parses the JSON body regardless. credentials:'omit' so no
  // Google cookies ride along. The default referrer policy is left alone —
  // the API key's HTTP-referrer restriction in Cloud Console relies on it.
  fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit?key=${apiKey}`, {
    method: 'POST',
    keepalive: true,
    credentials: 'omit',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(body),
  }).catch(() => {});
};

try {
  const url = new URL(location.href);
  const params = new URLSearchParams(url.search);
  cleanAddressBar(url);

  const navType = performance.getEntriesByType('navigation')[0]?.type;
  const host = referrerHost();
  // A /go/ alias hop arrives with the alias page as its referrer, so an
  // explicit ?ref= wins over the internal-navigation exit.
  const isInternal = host === location.hostname && !sanitize(params.get('ref'));

  const skip = navigator.globalPrivacyControl === true
    || navType === 'reload'
    || navType === 'back_forward'
    || isInternal
    || params.get('internal') === '1'
    || location.hostname === 'localhost'
    || location.hostname === '127.0.0.1';

  if (!skip && projectId && apiKey) {
    logArrival(resolveSource(params, host), location.pathname.slice(0, MAX_PATH));
  }
} catch {
  // Fire-and-forget: attribution is never worth breaking a page over.
}
