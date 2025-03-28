// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, enableIndexedDbPersistence, orderBy } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA8D04mYCplD_BVEZStQIba-nqSy3KSvEg",
  authDomain: "subman-5a53f.firebaseapp.com",
  projectId: "subman-5a53f",
  storageBucket: "subman-5a53f.firebasestorage.app",
  messagingSenderId: "617291820103",
  appId: "1:617291820103:web:cd9f9de6b810a9e0f2d562",
  measurementId: "G-QH15R3F183"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
// Initialize Firestore with settings to improve reliability
const db = getFirestore(app);
const storage = getStorage(app);

// Enable offline persistence with improved error handling
try {
  // Enable persistence without additional settings
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time
      console.log('Persistence failed: Multiple tabs open');
      // This is expected behavior in multiple tabs, so we can continue without crashing
    } else if (err.code === 'unimplemented') {
      // The current browser does not support persistence
      console.log('Persistence not supported by this browser');
    } else {
      // Other errors like network issues
      console.error('Firestore persistence error:', err);
    }
  });
} catch (error) {
  // Handle any unexpected errors during initialization
  console.error('Error initializing Firestore persistence:', error);
}

export { 
  app, 
  analytics, 
  auth, 
  db, 
  storage,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
};