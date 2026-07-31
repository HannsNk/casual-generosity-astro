import { auth, googleProvider, db } from '../lib/firebase.js';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const signInBtn = document.getElementById('auth-signin');
const signedInBox = document.getElementById('auth-signedin');
const nameEl = document.getElementById('auth-name');
const signOutBtn = document.getElementById('auth-signout');

signInBtn.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error('Sign-in failed', err);
  }
});

signOutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user) {
    signInBtn.hidden = true;
    signedInBox.hidden = false;
    nameEl.textContent = user.displayName ?? user.email;

    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        displayName: user.displayName ?? '',
        photoURL: user.photoURL ?? '',
        bio: '',
        createdAt: serverTimestamp(),
      });
    }
  } else {
    signInBtn.hidden = false;
    signedInBox.hidden = true;
  }
});