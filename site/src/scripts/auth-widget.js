import { auth, googleProvider, db } from '../lib/firebase.js';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const trigger = document.getElementById('auth-signin');
const panel = document.getElementById('auth-panel');
const googleBtn = document.getElementById('auth-google');
const form = document.getElementById('auth-email-form');
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const errorEl = document.getElementById('auth-error');
const createBtn = document.getElementById('auth-create');
const submitBtn = form.querySelector('.auth-submit');

const signedInBox = document.getElementById('auth-signedin');
const nameEl = document.getElementById('auth-name');
const avatarEl = document.getElementById('auth-avatar');
const signOutBtn = document.getElementById('auth-signout');

let mode = 'signin';

const showError = (message) => {
  errorEl.textContent = message;
  errorEl.hidden = false;
};

const clearError = () => {
  errorEl.hidden = true;
  errorEl.textContent = '';
};

const openPanel = () => {
  panel.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  emailInput.focus();
};

const closePanel = () => {
  panel.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
};

trigger.addEventListener('click', () => {
  if (panel.hidden) openPanel();
  else closePanel();
});

document.addEventListener('click', (e) => {
  if (!panel.hidden && !panel.contains(e.target) && e.target !== trigger) {
    closePanel();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !panel.hidden) {
    closePanel();
    trigger.focus();
  }
});

googleBtn.addEventListener('click', async () => {
  clearError();
  try {
    await signInWithPopup(auth, googleProvider);
    closePanel();
  } catch (err) {
    console.error('Google sign-in failed', err);
    showError('Google sign-in failed — try again.');
  }
});

createBtn.addEventListener('click', () => {
  mode = mode === 'signup' ? 'signin' : 'signup';
  submitBtn.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
  createBtn.textContent = mode === 'signup' ? 'Sign in instead' : 'Create account';
  clearError();
});

const emailAuthErrorMessage = (code) => {
  switch (code) {
    case 'auth/invalid-email':
      return "That email doesn't look right.";
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account already exists for that email.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    default:
      return 'Something went wrong — try again.';
  }
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return;

  submitBtn.disabled = true;
  try {
    if (mode === 'signup') {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    form.reset();
    closePanel();
  } catch (err) {
    console.error('Email auth failed', err);
    showError(emailAuthErrorMessage(err.code));
  } finally {
    submitBtn.disabled = false;
  }
});

signOutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user) {
    trigger.hidden = true;
    closePanel();
    signedInBox.hidden = false;

    const displayName = user.displayName ?? user.email ?? '';
    nameEl.textContent = displayName;
    if (user.photoURL) {
      avatarEl.style.backgroundImage = `url(${user.photoURL})`;
      avatarEl.textContent = '';
    } else {
      avatarEl.style.backgroundImage = '';
      avatarEl.textContent = displayName.charAt(0).toUpperCase();
    }

    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        photoURL: user.photoURL ?? '',
        bio: '',
        createdAt: serverTimestamp(),
      });
    }
  } else {
    trigger.hidden = false;
    signedInBox.hidden = true;
  }
});
