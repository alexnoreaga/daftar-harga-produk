import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBndwU3NRVcnjkZmZTTH_sMj-Nqovt8sjQ",
  authDomain: "harga-modal.firebaseapp.com",
  projectId: "harga-modal",
  storageBucket: "harga-modal.firebasestorage.app",
  messagingSenderId: "409182709524",
  appId: "1:409182709524:web:b376e0f173c3351ff30401",
  measurementId: "G-BS00SYS0VG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);