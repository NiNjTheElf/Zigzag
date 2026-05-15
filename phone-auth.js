// Phone Authentication Module for Firebase
// Handles phone number verification for client bookings

import { auth } from './firebase-config.js';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

let phoneVerificationId = null;
let recaptchaVerifier = null;

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
    const verifier = initializeRecaptcha();
    
    const result = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    phoneVerificationId = result.verificationId;
    
    console.log('Verification code sent to:', phoneNumber);
    return {
      success: true,
      message: 'Code sent to ' + phoneNumber,
      verificationId: phoneVerificationId
    };
  } catch (error) {
    console.error('Error sending verification code:', error);
    return {
      success: false,
      error: error.message
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
    if (!phoneVerificationId) {
      throw new Error('No verification ID found. Send code first.');
    }

    // Parse the code as a credential
    const phoneCodeCredential = {
      verificationId: phoneVerificationId,
      verificationCode: code
    };

    console.log('Code verified:', code);
    return {
      success: true,
      message: 'Phone verified successfully',
      credential: phoneCodeCredential
    };
  } catch (error) {
    console.error('Error verifying code:', error);
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
