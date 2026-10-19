// Plain config values, with no Firebase SDK import. Kept apart from
// firebase.js because importing that module runs initializeApp/getAuth,
// which write to IndexedDB — arrival.js needs projectId/apiKey without that.
export const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
};

export const { apiKey, projectId } = firebaseConfig;
