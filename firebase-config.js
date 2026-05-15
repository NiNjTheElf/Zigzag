// Firebase Configuration File
// This file contains the Firebase initialization code for client-side authentication

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCYfXOI1gjrkYYxAS23mkIJSvrW7KXSAVI",
  authDomain: "zigzag-hairplace.firebaseapp.com",
  projectId: "zigzag-hairplace",
  storageBucket: "zigzag-hairplace.firebasestorage.app",
  messagingSenderId: "764262432377",
  appId: "1:764262432377:web:aafc7752572eba8b53dea8",
  measurementId: "G-WV3PCTSJMJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
const auth = getAuth(app);

// Initialize Analytics (optional)
const analytics = getAnalytics(app);

// Enable phone authentication
// Phone authentication is enabled by default in Firebase

export { auth, app, analytics };
