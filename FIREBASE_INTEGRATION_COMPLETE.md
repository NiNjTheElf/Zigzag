# Firebase & Phone Verification - Complete Integration Guide

## What Has Been Set Up

✅ **Firebase Configuration Files Created:**
- `firebase-config.js` - Firebase initialization with your project credentials
- `phone-auth.js` - Phone authentication module with verification logic
- `firebase-phone-integration.js` - Integration examples for your booking system
- `firebase.json` - Firebase Hosting configuration

✅ **Frontend Updates:**
- `booking.html` - Updated with Firebase script tags and reCAPTCHA container
- `public/` folder - Created for Firebase Hosting with all your files

✅ **Firebase CLI:**
- Installed globally (version 15.18.0)
- Ready for deployment

---

## How Phone Verification Works

### Flow Diagram:
```
1. User fills booking form
   ↓
2. User enters phone number (+371XXXXXXXX)
   ↓
3. Click "Book Appointment"
   ↓
4. reCAPTCHA v3 verification
   ↓
5. Firebase sends 6-digit code to phone
   ↓
6. User enters code
   ↓
7. Code verified
   ↓
8. Booking confirmed
```

---

## Step-by-Step Setup Instructions

### STEP 1: Login to Firebase
Run this command in PowerShell:
```powershell
firebase login
```
- A browser window will open
- Sign in with your Google account
- Accept permissions
- Close browser when done

---

### STEP 2: Select Your Firebase Project
```powershell
firebase use --add
```
- Choose: `zigzag-hairplace`
- Alias: `production` (or press Enter)

---

### STEP 3: Deploy to Firebase Hosting
```powershell
firebase deploy --only hosting
```

**Result:** Your site goes live at `https://zigzag-hairplace-ae551.web.app`

**Expected Output:**
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/zigzag-hairplace
Hosting URL: https://zigzag-hairplace-ae551.web.app
```

---

### STEP 4: Enable Phone Authentication
1. Open: https://console.firebase.google.com/project/zigzag-hairplace
2. Go to **Authentication** section
3. Click **Sign-in method** tab
4. Find **Phone** in the list
5. Click it and toggle **Enable**
6. Click **Save**

---

### STEP 5: Test Phone Verification

Visit: `https://zigzag-hairplace-ae551.web.app/booking.html`

**To test:**
1. Fill in the booking form
2. Enter a phone number with country code:
   - For testing: `+15551234567` (US test number)
   - Real number: `+371XXXXXXXX` (Latvia format)
3. Click "Book Appointment"
4. Firebase will send a verification code
5. Enter the code when prompted
6. Booking confirmed!

---

## File Structure After Setup

```
Zigzag/
├── public/                    ← Your hosted files
│   ├── index.html
│   ├── booking.html
│   ├── staff.html
│   ├── styles.css
│   ├── booking.js
│   ├── app.js
│   ├── firebase-config.js
│   ├── phone-auth.js
│   └── assets/
├── firebase-config.js         ← Firebase setup
├── phone-auth.js              ← Phone verification
├── firebase-phone-integration.js  ← Integration examples
├── firebase.json              ← Hosting config
├── FIREBASE_SETUP.md          ← Detailed guide
├── FIREBASE_QUICK_START.md    ← Quick commands
└── server.js                  ← Your Express server
```

---

## Integrating Phone Verification into Booking

Your `booking.js` file already has phone input and confirmation UI. To activate phone verification:

### Option A: Update Your Existing booking.js

Add this at the top of `booking.js`:

```javascript
import { initializePhoneAuth, handleBookingWithPhoneVerification } from './firebase-phone-integration.js';

// Initialize phone auth when page loads
document.addEventListener('DOMContentLoaded', () => {
  initializePhoneAuth();
});

// Update your form submission handler:
elements.bookingForm.addEventListener('submit', handleBookingWithPhoneVerification);
```

### Option B: Manual Integration

Use the code in `firebase-phone-integration.js` as a reference and integrate the functions:
- `handleBookingWithPhoneVerification()` - Handles form submission
- `handlePhoneCodeVerification()` - Validates the code
- `initializePhoneAuth()` - Sets up event listeners

---

## Backend Integration (Node.js/Express)

If you want to verify the phone on your backend as well:

```javascript
// In your server.js or API route
const { auth } = require('firebase/auth');

app.post('/api/bookings', async (req, res) => {
  try {
    const { client_phone, verified } = req.body;
    
    // Check if phone is verified
    if (!verified) {
      return res.status(400).json({ error: 'Phone not verified' });
    }
    
    // Save booking to database
    // Your existing code here...
    
    res.json({ success: true, message: 'Booking confirmed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Environment Variables (Optional)

Create a `.env` file if you want to manage Firebase config there:

```env
VITE_FIREBASE_API_KEY=AIzaSyCYfXOI1gjrkYYxAS23mkIJSvrW7KXSAVI
VITE_FIREBASE_AUTH_DOMAIN=zigzag-hairplace.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=zigzag-hairplace
VITE_FIREBASE_STORAGE_BUCKET=zigzag-hairplace.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=764262432377
VITE_FIREBASE_APP_ID=1:764262432377:web:aafc7752572eba8b53dea8
VITE_FIREBASE_MEASUREMENT_ID=G-WV3PCTSJMJ
```

---

## Phone Number Format by Country

When testing, use phone numbers with country codes:

```
Latvia: +371 XXXX XXXX (e.g., +37128123456)
USA:    +1 555 XXXX XXXX (e.g., +15551234567)
UK:     +44 20 XXXX XXXX (e.g., +442012345678)
EU:     +[country_code] followed by local number
```

---

## Testing with Firebase Emulator (Optional)

For local testing without real SMS costs:

```powershell
# Install emulator
firebase emulators:install

# Start emulator
firebase emulators:start
```

This will:
- Run a local Firebase instance
- Show test codes in the emulator UI
- No SMS charges for testing

---

## Deployment Checklist

- [ ] Run `firebase login`
- [ ] Run `firebase use --add`
- [ ] Run `firebase deploy --only hosting`
- [ ] Enable Phone Auth in Firebase Console
- [ ] Test at: https://zigzag-hairplace-ae551.web.app/booking.html
- [ ] Verify phone code is received
- [ ] Booking completes successfully

---

## Useful Commands

```powershell
# Deploy everything
firebase deploy

# Deploy only hosting (faster)
firebase deploy --only hosting

# View deployment logs
firebase hosting:log

# List all Firebase projects
firebase projects:list

# Switch projects
firebase use [project-id]

# View config
firebase functions:config:get

# Clear cache and redeploy
firebase deploy --force

# Emulate locally
firebase emulators:start
```

---

## Troubleshooting

### Issue: "firebase: command not found"
**Solution:** Run `npm install -g firebase-tools`

### Issue: "Error: Failed to authenticate"
**Solution:** Run `firebase login` again, make sure to grant permissions

### Issue: Phone code not received
**Solution:**
- Check Firebase Console → Authentication → Enable Phone
- Check browser console for errors (F12)
- Try test number: +15551234567
- Check phone number format includes country code

### Issue: "reCAPTCHA container not found"
**Solution:** Make sure `<div id="recaptcha-container"></div>` exists in booking.html

### Issue: Code shows as invalid
**Solution:**
- Make sure you're entering the exact code sent
- Code expires after 10 minutes
- Request a new code if needed

### Issue: Deployment shows 404 errors
**Solution:**
- Check that `public/` folder contains all files
- Verify `firebase.json` has correct `public` path
- Run `firebase deploy --only hosting` again

---

## Security Best Practices

1. **Never commit Firebase config to git** (it's public, but good practice)
2. **Enable reCAPTCHA v3** in Firebase Console for spam protection
3. **Validate phone numbers on backend** for extra security
4. **Set rate limiting** on verification code requests
5. **Use HTTPS only** (Firebase provides this automatically)
6. **Implement phone number verification cooldown** (e.g., 5 requests per hour)

---

## Next Steps

1. Run `firebase login`
2. Run `firebase use --add`
3. Run `firebase deploy --only hosting`
4. Enable Phone Auth in Firebase Console
5. Test your site at the Firebase URL
6. Update `booking.js` to use phone verification functions
7. Deploy backend updates if needed

---

## Support

- **Firebase Docs:** https://firebase.google.com/docs
- **Phone Auth:** https://firebase.google.com/docs/auth/web/phone-auth
- **Hosting:** https://firebase.google.com/docs/hosting
- **Console:** https://console.firebase.google.com/project/zigzag-hairplace

---

## Additional Features to Consider

- **Cloud Functions** - Automatically send confirmation SMS
- **Firestore** - Store bookings in database
- **Cloud Messaging** - Send booking reminders
- **Custom Domain** - Use your own domain instead of firebase URL
- **Analytics** - Track booking conversion rates

---

**Status:** ✅ Ready to deploy!

Run this command to go live:
```powershell
firebase login
firebase deploy --only hosting
```
