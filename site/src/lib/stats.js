import { db } from './firebase.js';
import { collection, getDocs } from 'firebase/firestore';

const stats = new Map();
const listeners = new Set();
let ready = false;

const notify = () => {
  listeners.forEach((fn) => fn(new Map(stats)));
};

// Registers a callback for whenever the public save/done counts change
// (initial load or a local bump). Fires immediately with the current map
// if it's already loaded, same pattern as onFavoritesChange.
export const onStatsChange = (fn) => {
  listeners.add(fn);
  if (ready) fn(new Map(stats));
  return () => listeners.delete(fn);
};

export const getStat = (slug) => stats.get(slug) ?? { saveCount: 0, doneCount: 0 };

// Adjusts one counter for a slug in the local cache and notifies —
// used right after a Firestore write we already know succeeded, so the
// UI updates instantly instead of waiting on a re-read.
export const bumpStat = (slug, field, delta) => {
  const current = stats.get(slug) ?? { saveCount: 0, doneCount: 0 };
  stats.set(slug, { ...current, [field]: Math.max(0, current[field] + delta) });
  notify();
};

(async () => {
  try {
    const snap = await getDocs(collection(db, 'activityStats'));
    snap.forEach((d) => {
      const data = d.data();
      stats.set(d.id, { saveCount: data.saveCount ?? 0, doneCount: data.doneCount ?? 0 });
    });
  } catch (err) {
    console.error('Failed to load activity stats', err);
  } finally {
    ready = true;
    notify();
  }
})();
