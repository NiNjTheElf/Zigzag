// Firebase Configuration File
// Uses browser ESM imports so Firebase Hosting can serve these files directly.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

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

// Initialize Analytics only when the browser supports it.
let analytics = null;
import("https://www.gstatic.com/firebasejs/10.13.2/firebase-analytics.js")
  .then(({ getAnalytics, isSupported }) => isSupported().then(supported => {
    if (supported) analytics = getAnalytics(app);
  }))
  .catch(() => {
    analytics = null;
  });

// Enable phone authentication
// Phone authentication is enabled by default in Firebase

export { auth, app, analytics };
