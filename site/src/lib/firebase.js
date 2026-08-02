import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp, runTransaction,
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const doneRecordRef = (uid, slug) => doc(db, 'doneRecords', `${uid}_${slug}`);
export const activityStatsRef = (slug) => doc(db, 'activityStats', slug);

// Marks an activity done for a signed-in user: drops any existing favorite,
// upserts the done record (merge, so a highlight/withWho/reaction captured
// on an earlier done — later undone — survives a redo), and bumps the
// activity's done count (creating it at 1 if this is the first time anyone's
// done it) — all as one atomic transaction. Counters are read-then-clamped
// at 0 rather than blindly incremented/decremented: a plain increment(-1)
// can be issued more than once for the same favorite/done edge (stale local
// state across tabs or devices), which would drive the public total negative
// with no way to recover short of a manual fix. `wasFavorited` (the caller
// already knows this from its own local cache) decides whether the same
// write also owes the save count a decrement.
export const markActivityDone = async (uid, slug, wasFavorited) => {
  const statsRef = activityStatsRef(slug);
  await runTransaction(db, async (tx) => {
    const statsSnap = await tx.get(statsRef);
    const current = statsSnap.exists() ? statsSnap.data() : {};
    const update = { doneCount: Math.max(0, (current.doneCount ?? 0) + 1) };
    if (wasFavorited) {
      update.saveCount = Math.max(0, (current.saveCount ?? 0) - 1);
    }

    tx.delete(doc(db, 'users', uid, 'favorites', slug));
    tx.set(doneRecordRef(uid, slug), {
      uid,
      activitySlug: slug,
      active: true,
      doneAt: serverTimestamp(),
    }, { merge: true });
    tx.set(statsRef, update, { merge: true });
  });
};

// Undoes a done mark: flips the record inactive (never deleted, so any
// captured content survives) and decrements the done count. Does not
// restore a favorite that was dropped when the activity was marked done.
export const undoActivityDone = async (uid, slug) => {
  const statsRef = activityStatsRef(slug);
  await runTransaction(db, async (tx) => {
    const statsSnap = await tx.get(statsRef);
    const current = statsSnap.exists() ? statsSnap.data() : {};
    tx.update(doneRecordRef(uid, slug), { active: false });
    tx.set(statsRef, { doneCount: Math.max(0, (current.doneCount ?? 0) - 1) }, { merge: true });
  });
};

// Patches whichever quick-capture fields were filled in onto the done
// record. Only ever called after markActivityDone, so the doc already exists.
export const patchDoneRecord = async (uid, slug, fields) => {
  await setDoc(doneRecordRef(uid, slug), fields, { merge: true });
};

// Returns true if the current user is signed in AND has not yet
// seen onboarding. False if signed out (nothing to show) or already seen.
export const shouldShowOnboarding = async () => {
  const user = auth.currentUser;
  if (!user) return false;
  const snap = await getDoc(doc(db, 'users', user.uid));
  if (!snap.exists()) return false;
  return snap.data().onboardingSeen !== true;
};

// Marks onboarding as seen. Called on skip, close, or completion —
// all three count as "seen," none of them should re-trigger it.
export const markOnboardingSeen = async () => {
  const user = auth.currentUser;
  if (!user) return;
  await setDoc(doc(db, 'users', user.uid), { onboardingSeen: true }, { merge: true });
};