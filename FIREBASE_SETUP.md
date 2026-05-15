# Firebase Setup Guide for ZigZag Hairplace

This guide will help you set up Firebase Hosting and Phone Authentication for your salon booking system.

## Prerequisites

- Firebase project already created at: https://console.firebase.google.com/project/zigzag-hairplace
- Node.js installed on your system
- Firebase CLI installed globally

---

## Step 1: Install Firebase CLI

Run this command in PowerShell:

```powershell
npm install -g firebase-tools
```

Verify installation:
```powershell
firebase --version
```

---

## Step 2: Create Public Folder for Hosting

Firebase Hosting requires a `public` folder. Set it up:

```powershell
# From your project directory
mkdir public
```

Copy your HTML files to the public folder:
```powershell
# Copy HTML files
Copy-Item booking.html public/
Copy-Item index.html public/
Copy-Item staff.html public/

# Copy CSS and JS files
Copy-Item styles.css public/
Copy-Item *.js public/

# Copy assets folder
Copy-Item assets public/ -Recurse

# Copy Firebase config files
Copy-Item firebase-config.js public/
Copy-Item phone-auth.js public/
```

---

## Step 3: Login to Firebase

Run this command and follow the browser authentication:

```powershell
firebase login
```

You'll be prompted to allow Firebase CLI to access your account. Click "Allow".

---

## Step 4: Initialize Firebase Project

From your project directory:

```powershell
firebase init hosting
```

When prompted:
- **Select hosting setup:** Choose "Hosting: Configure files for Firebase Hosting"
- **Public directory:** Type `public` (or just press Enter if it's the default)
- **Single-page app (rewrite all urls to /index.html)?** Type `y` (yes)
- **Overwrite existing files?** Type `n` (no, since we have firebase.json)

---

## Step 5: Configure Phone Authentication in Firebase Console

1. Go to: https://console.firebase.google.com/project/zigzag-hairplace/authentication
2. Click "Sign-in method" tab
3. Enable "Phone" authentication:
   - Find and click "Phone"
   - Toggle it ON
   - Save
4. Enable reCAPTCHA v3:
   - In the same console, you should see reCAPTCHA options
   - Enable reCAPTCHA v3 for security

---

## Step 6: Update Environment Variables

Create or update your `.env` file with Firebase credentials (already added):

```
FIREBASE_API_KEY=AIzaSyCYfXOI1gjrkYYxAS23mkIJSvrW7KXSAVI
FIREBASE_AUTH_DOMAIN=zigzag-hairplace.firebaseapp.com
FIREBASE_PROJECT_ID=zigzag-hairplace
FIREBASE_STORAGE_BUCKET=zigzag-hairplace.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=764262432377
FIREBASE_APP_ID=1:764262432377:web:aafc7752572eba8b53dea8
```

---

## Step 7: Deploy to Firebase Hosting

```powershell
# Deploy to Firebase Hosting
firebase deploy --only hosting
```

Your site will be live at: https://zigzag-hairplace-ae551.web.app

---

## Step 8: Enable Additional Firebase Features

### Enable Firestore (for storing bookings):
1. Go to: https://console.firebase.google.com/project/zigzag-hairplace/firestore
2. Click "Create database"
3. Select "Start in production mode"
4. Choose region (e.g., `europe-west1`)
5. Click "Enable"

### Enable Cloud Functions (for sending SMS):
1. Go to: https://console.firebase.google.com/project/zigzag-hairplace/functions
2. Click "Get Started"
3. Select Node.js 18 as runtime
4. Create your first function

---

## Step 9: Test Phone Verification

1. Go to your deployed site: https://zigzag-hairplace-ae551.web.app/booking.html
2. Fill in the booking form
3. Enter a phone number with country code: `+371XXXXXXXX` (Latvia)
4. When you submit, you should receive a verification code (or see it in test mode)

**Test Numbers:**
For development, use these test phone numbers:
- `+15551234567` (US)
- `+371XXXXXXXX` (Latvia - replace X with digits)

Firebase console will generate test codes for these numbers.

---

## Step 10: Setup Hosting Rewrite Rules (for API)

Since your Express server runs on a different port, update `firebase.json`:

```json
{
  "hosting": {
    "site": "zigzag-hairplace-ae551",
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "/api/**",
        "destination": "http://localhost:3000"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

Then deploy again:
```powershell
firebase deploy --only hosting
```

---

## Useful Commands

```powershell
# Deploy everything
firebase deploy

# Deploy only hosting
firebase deploy --only hosting

# View logs
firebase functions:log

# Test locally
firebase emulators:start

# List deployed sites
firebase hosting:sites:list

# Switch between sites (if you have multiple)
firebase target:clear hosting
firebase target:apply hosting mySite zigzag-hairplace-ae551
```

---

## Environment Variables for Production

Add these to Firebase Functions environment (if using Cloud Functions):

```powershell
firebase functions:config:set twilio.account_sid="YOUR_TWILIO_SID"
firebase functions:config:set twilio.auth_token="YOUR_TWILIO_TOKEN"
firebase functions:config:set twilio.phone_number="+YOUR_TWILIO_NUMBER"
```

---

## Security Rules

### Firestore Rules (if using Firestore):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /bookings/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Firebase Hosting Security Headers:

Already configured in `firebase.json` with cache headers for performance.

---

## Troubleshooting

**Issue: "firebase: command not found"**
- Solution: Install globally with `npm install -g firebase-tools`

**Issue: "Error: Unexpected token < in JSON"**
- Solution: Make sure `firebase.json` is valid JSON (no trailing commas)

**Issue: Phone verification not working**
- Solution: 
  - Check Firebase Console → Authentication → Sign-in methods → Phone is enabled
  - Verify reCAPTCHA v3 is enabled
  - Check browser console for errors (F12)

**Issue: API calls fail after deployment**
- Solution: Update `firebase.json` rewrite rules to point to your server URL

---

## Next Steps

1. ✅ Install Firebase CLI
2. ✅ Login to Firebase
3. ✅ Create public folder
4. ✅ Deploy to Firebase Hosting
5. ✅ Enable Phone Authentication
6. ✅ Test phone verification
7. Configure Cloud Functions for SMS sending (optional)
8. Set up Firestore for booking storage (optional)
9. Configure custom domain (optional)

---

## Support & Resources

- Firebase Docs: https://firebase.google.com/docs
- Phone Auth Tutorial: https://firebase.google.com/docs/auth/web/phone-auth
- Hosting Guide: https://firebase.google.com/docs/hosting
- Console: https://console.firebase.google.com/project/zigzag-hairplace
