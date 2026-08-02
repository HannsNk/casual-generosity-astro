import { auth, db, activityStatsRef } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, getDocs, serverTimestamp, writeBatch, increment,
} from 'firebase/firestore';

let uid = null;
let ready = false;
const favSlugs = new Set();
const listeners = new Set();

const notify = () => {
  listeners.forEach((fn) => fn(new Set(favSlugs)));
};

// Registers a callback for whenever the signed-in user's favorite set
// changes (sign-in, sign-out, or a toggle). Fires immediately with the
// current set if it's already loaded.
export const onFavoritesChange = (fn) => {
  listeners.add(fn);
  if (ready) fn(new Set(favSlugs));
  return () => listeners.delete(fn);
};

onAuthStateChanged(auth, async (user) => {
  ready = false;
  favSlugs.clear();
  uid = user ? user.uid : null;

  if (uid) {
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'favorites'));
      snap.forEach((d) => favSlugs.add(d.id));
    } catch (err) {
      console.error('Failed to load favorites', err);
    }
  }

  ready = true;
  notify();
});

// Toggles a favorite for the signed-in user, updating the in-memory set
// (and notifying subscribers) before the Firestore write resolves, then
// rolling back on failure. Returns null if the user isn't signed in yet —
// in that case it kicks off the existing sign-in flow instead of failing
// silently, matching the AuthWidget's own trigger button. The favorite doc
// and the activity's public save count are written as one atomic batch.
export const toggleFavorite = async (slug) => {
  if (!uid) {
    document.getElementById('auth-signin')?.click();
    return null;
  }

  const willFavorite = !favSlugs.has(slug);
  willFavorite ? favSlugs.add(slug) : favSlugs.delete(slug);
  notify();

  const ref = doc(db, 'users', uid, 'favorites', slug);
  try {
    const batch = writeBatch(db);
    if (willFavorite) {
      batch.set(ref, { createdAt: serverTimestamp() });
    } else {
      batch.delete(ref);
    }
    batch.set(activityStatsRef(slug), { saveCount: increment(willFavorite ? 1 : -1) }, { merge: true });
    await batch.commit();
  } catch (err) {
    console.error('Failed to update favorite', err);
    willFavorite ? favSlugs.delete(slug) : favSlugs.add(slug);
    notify();
    return !willFavorite;
  }

  return willFavorite;
};

// Drops a slug from the in-memory favorite set without a Firestore write —
// used when marking an activity done, which deletes the favorite doc as
// part of its own batch, so the heart button just needs to catch up locally.
export const clearFavoriteLocal = (slug) => {
  if (favSlugs.delete(slug)) notify();
};

// Whether the signed-in user currently has this slug favorited, per the
// local cache — used to decide whether marking an activity done also owes
// the save count a decrement, without an extra read.
export const isFavoritedLocal = (slug) => favSlugs.has(slug);
