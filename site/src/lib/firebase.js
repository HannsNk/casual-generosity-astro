import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp,
  collection, query, where, getDocs,
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

// Public fact: the signed-in user's current relationship to an activity —
// 'favorited' or 'done'. One doc per uid+slug, so marking done simply
// overwrites whatever was there (no separate delete needed to drop a prior
// favorite — see markActivityDone).
export const activityInteractionRef = (uid, slug) => doc(db, 'activityInteractions', `${uid}_${slug}`);

// Private detail: highlight/withWho/reaction captured on Done. Keyed the
// same way, but a separate collection so it can stay owner-only and, per
// Undo Done, survive deletion of the interaction doc above.
export const doneDetailsRef = (uid, slug) => doc(db, 'doneDetails', `${uid}_${slug}`);

// Favourite: single upsert. Only ever called while the activity isn't
// currently done — Base.astro's click handler redirects a fav-muted click
// to the done button instead of calling this.
export const setFavorited = async (uid, slug) => {
  await setDoc(activityInteractionRef(uid, slug), {
    uid,
    activitySlug: slug,
    state: 'favorited',
    createdAt: serverTimestamp(),
    doneAt: null,
  });
};

// Unfavourite: only ever called while state is 'favorited', so a plain
// delete is safe — there's no done record on this doc to preserve.
export const clearFavorited = async (uid, slug) => {
  await deleteDoc(activityInteractionRef(uid, slug));
};

// Mark Done: one upsert overwriting the interaction doc to state 'done'.
// This is the same doc a prior favorite lived on, so it needs no separate
// write to clear one. doneDetails (highlight/withWho/reaction) is patched
// separately, after the quick-capture panel resolves — see patchDoneDetails.
export const markActivityDone = async (uid, slug) => {
  await setDoc(activityInteractionRef(uid, slug), {
    uid,
    activitySlug: slug,
    state: 'done',
    createdAt: serverTimestamp(),
    doneAt: serverTimestamp(),
  });
};

// Undo Done: deletes the interaction doc outright (not a soft-inactive flag)
// so a fresh Favourite/Done both start clean. doneDetails is deliberately
// left alone so a later re-Done shows the previously captured highlight.
export const undoActivityDone = async (uid, slug) => {
  await deleteDoc(activityInteractionRef(uid, slug));
};

// Patches whichever quick-capture fields were filled in. Only ever called
// after markActivityDone, so the doc may or may not already exist —
// merge:true covers both.
export const patchDoneDetails = async (uid, slug, fields) => {
  await setDoc(doneDetailsRef(uid, slug), {
    uid,
    activitySlug: slug,
    ...fields,
  }, { merge: true });
};

// Deletes all of a uid's doneDetails docs. Must run client-side, before
// calling Firebase Auth's deleteUser — doneDetails is owner-only, so it's
// unreachable once the account (and its auth token) is gone. The public
// activityInteractions facts are deliberately left untouched; they persist
// as historical record even after the account is deleted.
export const deleteAccountData = async (uid) => {
  const snap = await getDocs(query(collection(db, 'doneDetails'), where('uid', '==', uid)));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
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
