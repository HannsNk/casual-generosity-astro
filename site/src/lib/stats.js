import { db } from './firebase.js';
import {
  collection, query, where, getCountFromServer,
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

// Fetches live saved/done counts for a batch of slugs — there's no stored
// counters collection to bulk-read anymore, so this runs two aggregation
// count() queries per slug (favorited, done), in parallel.
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
