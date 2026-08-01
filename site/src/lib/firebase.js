import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, setDoc, increment, serverTimestamp, writeBatch,
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
// done it) — all as one atomic batch. increment() resolves against a
// missing field/doc as 0, so the create-if-absent case needs no read.
export const markActivityDone = async (uid, slug) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', uid, 'favorites', slug));
  batch.set(doneRecordRef(uid, slug), {
    uid,
    activitySlug: slug,
    active: true,
    doneAt: serverTimestamp(),
  }, { merge: true });
  batch.set(activityStatsRef(slug), { doneCount: increment(1) }, { merge: true });
  await batch.commit();
};

// Undoes a done mark: flips the record inactive (never deleted, so any
// captured content survives) and decrements the done count. Does not
// restore a favorite that was dropped when the activity was marked done.
export const undoActivityDone = async (uid, slug) => {
  const batch = writeBatch(db);
  batch.update(doneRecordRef(uid, slug), { active: false });
  batch.update(activityStatsRef(slug), { doneCount: increment(-1) });
  await batch.commit();
};

// Patches whichever quick-capture fields were filled in onto the done
// record. Only ever called after markActivityDone, so the doc already exists.
export const patchDoneRecord = async (uid, slug, fields) => {
  await setDoc(doneRecordRef(uid, slug), fields, { merge: true });
};