# Firebase Setup - Quick Start Commands

Run these commands in PowerShell in order:

## 1. Login to Firebase

```powershell
firebase login
```

**What to do:**
- This will open a browser window
- Sign in with your Google account (the one associated with your Firebase project)
- Grant permission to Firebase CLI
- Close the browser when done

---

## 2. Link Firebase Project (After Login)

```powershell
firebase use --add
```

**What to do:**
- Select "zigzag-hairplace" from the list
- Give it an alias (e.g., "production" or just press Enter)

---

## 3. Deploy to Firebase Hosting

```powershell
firebase deploy --only hosting
```

This will:
- Upload your public folder to Firebase Hosting
- Generate your live URL: https://zigzag-hairplace-ae551.web.app

---

## 4. Enable Phone Authentication in Firebase Console

After deployment, do this in your browser:

1. Go to: https://console.firebase.google.com/project/zigzag-hairplace/authentication
2. Click "Sign-in method" tab
3. Find "Phone" and click it
4. Toggle the switch ON
5. Click "Save"

---

## 5. Test Your Site

Visit: https://zigzag-hairplace-ae551.web.app/booking.html

You should see:
- Your booking form with phone number field
- When submitting, the phone verification should trigger

---

## Important Files Created:

- ✅ `firebase-config.js` - Firebase initialization
- ✅ `phone-auth.js` - Phone authentication module
- ✅ `firebase.json` - Hosting configuration
- ✅ `public/` folder - Files for Firebase Hosting
- ✅ `FIREBASE_SETUP.md` - Detailed setup guide

---

## Run Firebase Deploy Command Now:

The next step is authentication, so copy-paste this in PowerShell:

```powershell
firebase login
```
