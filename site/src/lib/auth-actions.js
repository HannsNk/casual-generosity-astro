// The site's one sign-in flow — Google popup, or email + password with a
// create-account mode — shared by the nav's AuthWidget and the starter
// pack's signup ask so both stay identical.
import { auth, googleProvider } from './firebase.js';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

// mode: 'signin' | 'signup'
export const signInWithEmail = (mode, email, password) => (
  mode === 'signup'
    ? createUserWithEmailAndPassword(auth, email, password)
    : signInWithEmailAndPassword(auth, email, password)
);

export const emailAuthErrorMessage = (code) => {
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
      return 'Something went wrong. Try again.';
  }
};
