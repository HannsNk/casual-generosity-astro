import { db } from './firebase.js';
import {
  collection, query, where, getCountFromServer, getDocs,
} from 'firebase/firestore';

const stats = new Map();
const listeners = new Set();

const notify = () => {
  listeners.forEach((fn) => fn(new Map(stats)));
};

// Registers a callback for whenever the live save/done counts change
// (initial load or a local bump). Fires immediately with whatever's
// already cached, same pattern as onFavoritesChange.
export const onStatsChange = (fn) => {
  listeners.add(fn);
  if (stats.size) fn(new Map(stats));
  return () => listeners.delete(fn);
};

export const getStat = (slug) => stats.get(slug) ?? { saveCount: 0, doneCount: 0 };

// Adjusts one counter for a slug in the local cache and notifies — used
// right after a Firestore write we already know succeeded, so the UI
// updates instantly instead of waiting on a fresh aggregation query.
export const bumpStat = (slug, field, delta) => {
  const current = stats.get(slug) ?? { saveCount: 0, doneCount: 0 };
  stats.set(slug, { ...current, [field]: Math.max(0, current[field] + delta) });
  notify();
};

const countFor = (slug, state) => getCountFromServer(query(
  collection(db, 'activityInteractions'),
  where('activitySlug', '==', slug),
  where('state', '==', state),
)).then((snap) => snap.data().count);

// Fetches live saved/done counts for a batch of slugs via per-slug
// aggregation count() queries, in parallel — fine for the detail page, which
// only ever asks for one slug at a time (2 requests total).
export const loadStats = async (slugs) => {
  await Promise.all([...new Set(slugs)].map(async (slug) => {
    const [saveCount, doneCount] = await Promise.all([
      countFor(slug, 'favorited'),
      countFor(slug, 'done'),
    ]);
    stats.set(slug, { saveCount, doneCount });
  }));
  notify();
};

// Firestore caps `in` queries at 30 values — chunk stays comfortably under
// that regardless of how many slugs are passed in.
const IN_QUERY_CHUNK_SIZE = 24;

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// Counts documents per slug for one state ('favorited' or 'done') across a
// set of slugs, via `in` queries — count() aggregation can't group by field,
// so this fetches the actual (tiny, field-free-payload) docs and tallies
// them client-side.
const countsByState = async (slugs, state) => {
  const counts = new Map();
  await Promise.all(chunk(slugs, IN_QUERY_CHUNK_SIZE).map(async (group) => {
    const snap = await getDocs(query(
      collection(db, 'activityInteractions'),
      where('activitySlug', 'in', group),
      where('state', '==', state),
    ));
    snap.forEach((d) => {
      const { activitySlug } = d.data();
      counts.set(activitySlug, (counts.get(activitySlug) ?? 0) + 1);
    });
  }));
  return counts;
};

// Grid-scale variant of loadStats: instead of 2 aggregation queries per
// card, this runs 2 `in` queries per chunk of up to IN_QUERY_CHUNK_SIZE
// slugs (favorited, done) and groups the results client-side — 2 requests
// total for a normal 24-card page.
export const loadGridStats = async (slugs) => {
  const uniqueSlugs = [...new Set(slugs)];
  if (!uniqueSlugs.length) return;

  const [saveCounts, doneCounts] = await Promise.all([
    countsByState(uniqueSlugs, 'favorited'),
    countsByState(uniqueSlugs, 'done'),
  ]);

  uniqueSlugs.forEach((slug) => {
    stats.set(slug, {
      saveCount: saveCounts.get(slug) ?? 0,
      doneCount: doneCounts.get(slug) ?? 0,
    });
  });
  notify();
};
