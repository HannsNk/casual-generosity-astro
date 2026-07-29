import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyA-OosRUhIt6NoammyFOWrF-lS0uuYQo0I',
  authDomain: 'casually-generous.firebaseapp.com',
  projectId: 'casually-generous',
  storageBucket: 'casually-generous.firebasestorage.app',
  messagingSenderId: '400086556758',
  appId: '1:400086556758:web:b69c331d78903e61d99bf7',
  measurementId: 'G-N8SLVNX4GN',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
