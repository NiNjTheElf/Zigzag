// Phone Authentication Module for Firebase
// Handles phone number verification for client bookings

import { auth } from './firebase-config.js';
import {
  deleteUser,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithCredential,
  signInWithPhoneNumber,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

let phoneVerificationId = null;
let phoneVerificationPhone = null;
let phoneVerificationExpiresAt = 0;
let confirmationResult = null;
let recaptchaVerifier = null;

const VERIFICATION_TTL_MS = 10 * 60 * 1000;

function hasReusableVerification(phoneNumber) {
  return (
    phoneVerificationId &&
    phoneVerificationPhone === phoneNumber &&
    phoneVerificationExpiresAt > Date.now()
  );
}

/**
 * Initialize reCAPTCHA verifier for phone authentication
 * Call this once when the page loads
 */
export function initializeRecaptcha() {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
      'callback': (response) => {
        console.log('reCAPTCHA verified');
      }
    });
  }
  return recaptchaVerifier;
}

/**
 * Send verification code to phone number
 * @param {string} phoneNumber - Phone number with country code (e.g., +37128xxx)
 * @returns {Promise} - Resolves when code is sent
 */
export async function sendPhoneVerificationCode(phoneNumber) {
  try {
    if (hasReusableVerification(phoneNumber)) {
      return {
        success: true,
        reused: true,
        message: 'Code was already sent to ' + phoneNumber,
        verificationId: phoneVerificationId
      };
    }

    const verifier = initializeRecaptcha();
    
    const result = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    confirmationResult = result;
    phoneVerificationId = result.verificationId;
    phoneVerificationPhone = phoneNumber;
    phoneVerificationExpiresAt = Date.now() + VERIFICATION_TTL_MS;
    
    console.log('Verification code sent to:', phoneNumber);
    return {
      success: true,
      message: 'Code sent to ' + phoneNumber,
      verificationId: phoneVerificationId
    };
  } catch (error) {
    console.error('Error sending verification code:', error);
    await resetRecaptchaChallenge();
    return {
      success: false,
      error: getPhoneAuthErrorMessage(error)
    };
  }
}

/**
 * Verify the code entered by the user
 * @param {string} code - The 6-digit verification code
 * @returns {Promise} - Resolves with user credential if successful
 */
export async function verifyPhoneCode(code) {
  try {
    if (!confirmationResult && !phoneVerificationId) {
      throw new Error('No verification ID found. Send code first.');
    }

    const userCredential = confirmationResult
      ? await confirmationResult.confirm(code)
      : await signInWithCredential(auth, PhoneAuthProvider.credential(phoneVerificationId, code));

    console.log('Phone code verified');
    return {
      success: true,
      message: 'Phone verified successfully',
      user: userCredential.user
    };
  } catch (error) {
    console.error('Error verifying code:', error);
    return {
      success: false,
      error: getPhoneAuthErrorMessage(error)
    };
  }
}

async function resetRecaptchaChallenge() {
  if (!recaptchaVerifier) return;

  try {
    const widgetId = await recaptchaVerifier.render();
    window.grecaptcha?.reset(widgetId);
  } catch (error) {
    console.warn('Could not reset Firebase reCAPTCHA challenge:', error);
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
}

function getPhoneAuthErrorMessage(error) {
  switch (error?.code) {
    case 'auth/invalid-phone-number':
      return 'Enter the phone number in international format, for example +371XXXXXXXX.';
    case 'auth/too-many-requests':
      return 'Too many SMS requests for this number. Try again later or use a different phone number.';
    case 'auth/quota-exceeded':
      return 'Firebase SMS quota was exceeded. Try again later.';
    case 'auth/captcha-check-failed':
    case 'auth/missing-app-credential':
    case 'auth/invalid-app-credential':
      return 'Firebase reCAPTCHA check failed. Refresh the page and try again.';
    case 'auth/code-expired':
      return 'The SMS code expired. Request a new one.';
    case 'auth/invalid-verification-code':
      return 'The SMS code is incorrect.';
    default:
      return error?.message || 'Firebase phone verification failed.';
  }
}

/**
 * Delete the temporary Firebase phone-auth user after the booking is saved.
 * This keeps Firebase Auth from filling up with one-time booking identities.
 */
export async function deleteVerifiedPhoneUser(phoneNumber) {
  const user = auth.currentUser;
  if (!user) {
    resetPhoneVerification();
    return { success: true, skipped: true };
  }

  try {
    if (phoneNumber && user.phoneNumber && user.phoneNumber !== phoneNumber) {
      throw new Error('Signed-in Firebase phone user does not match the verified booking phone.');
    }

    await deleteUser(user);
    resetPhoneVerification();
    return { success: true };
  } catch (error) {
    console.warn('Could not delete Firebase phone user, signing out instead:', error);
    await signOut(auth).catch(() => {});
    resetPhoneVerification();
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Reset phone verification state
 */
export function resetPhoneVerification() {
  phoneVerificationId = null;
  phoneVerificationPhone = null;
  phoneVerificationExpiresAt = 0;
  confirmationResult = null;
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
}

/**
 * Get current verification ID
 */
export function getVerificationId() {
  return phoneVerificationId;
}
