// Integration example for Firebase Phone Authentication with booking system
// This shows how to integrate phone verification into your existing booking flow

// Import Firebase Auth and Phone Auth functions
import { auth } from './firebase-config.js';
import { sendPhoneVerificationCode, verifyPhoneCode, initializeRecaptcha } from './phone-auth.js';

/**
 * Handle booking form submission with phone verification
 * Integrate this into your existing booking form handler
 */
async function handleBookingWithPhoneVerification(event) {
  event.preventDefault();
  
  try {
    // Get phone number from form
    const phoneNumber = document.getElementById('client-phone').value.trim();
    
    // Validate phone number format (basic validation)
    if (!phoneNumber.startsWith('+')) {
      showToast('Please enter phone number with country code (e.g., +371XXXXXXXX)');
      return;
    }
    
    // Show loading state
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Sending verification code...';
    
    // Send verification code to phone
    const result = await sendPhoneVerificationCode(phoneNumber);
    
    if (result.success) {
      // Show confirmation panel to enter code
      showPhoneVerificationPanel(phoneNumber);
      showToast('Verification code sent to ' + phoneNumber);
    } else {
      showToast('Error sending code: ' + result.error);
    }
    
    // Reset button
    submitButton.disabled = false;
    submitButton.textContent = originalText;
    
  } catch (error) {
    showToast('Error: ' + error.message);
  }
}

/**
 * Show phone verification panel to user
 */
function showPhoneVerificationPanel(phoneNumber) {
  const panel = document.getElementById('booking-confirmation');
  const message = document.getElementById('booking-confirmation-message');
  
  message.textContent = `We sent a 6-digit verification code to ${phoneNumber}. Enter it below.`;
  
  if (panel) {
    panel.classList.remove('hidden');
    document.getElementById('booking-confirmation-code').focus();
  }
}

/**
 * Handle verification code submission
 */
async function handlePhoneCodeVerification(code) {
  try {
    if (code.length !== 6) {
      showToast('Please enter a 6-digit code');
      return;
    }
    
    const result = await verifyPhoneCode(code);
    
    if (result.success) {
      showToast('Phone verified successfully!');
      
      // Now complete the booking
      await completeBooking();
      
      // Hide verification panel
      document.getElementById('booking-confirmation').classList.add('hidden');
      document.getElementById('booking-confirmation-code').value = '';
      
    } else {
      showToast('Invalid code: ' + result.error);
    }
    
  } catch (error) {
    showToast('Error verifying code: ' + error.message);
  }
}

/**
 * Complete booking after phone verification
 * This is your existing booking completion logic
 */
async function completeBooking() {
  try {
    // Your existing booking API call
    const bookingData = {
      barber_id: document.getElementById('booking-barber').value,
      booking_date: document.getElementById('booking-date').value,
      booking_time: document.getElementById('booking-time').value,
      service_type: document.getElementById('booking-service').value,
      client_name: document.getElementById('client-name').value,
      client_phone: document.getElementById('client-phone').value,
      verified: true  // Mark as phone verified
    };
    
    // Call your backend API to save booking
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save booking');
    }
    
    const result = await response.json();
    showToast('Booking confirmed!');
    
    // Reset form
    document.getElementById('booking-form').reset();
    
    return result;
    
  } catch (error) {
    showToast('Error completing booking: ' + error.message);
    throw error;
  }
}

/**
 * Initialize phone authentication when page loads
 * Call this on page load
 */
function initializePhoneAuth() {
  try {
    // Initialize reCAPTCHA
    initializeRecaptcha();
    
    // Set up phone verification code input
    const codeInput = document.getElementById('booking-confirmation-code');
    if (codeInput) {
      codeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handlePhoneCodeVerification(codeInput.value);
        }
      });
    }
    
    // Set up confirm button
    const confirmButton = document.getElementById('booking-confirm-button');
    if (confirmButton) {
      confirmButton.addEventListener('click', () => {
        const code = document.getElementById('booking-confirmation-code').value;
        handlePhoneCodeVerification(code);
      });
    }
    
    console.log('Phone authentication initialized');
  } catch (error) {
    console.error('Error initializing phone auth:', error);
  }
}

/**
 * Show toast notification
 */
function showToast(message) {
  const toast = document.getElementById('booking-toast');
  if (toast) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hidden');
    }, 3200);
  }
}

/**
 * Export functions for use in booking.js
 */
export {
  handleBookingWithPhoneVerification,
  handlePhoneCodeVerification,
  initializePhoneAuth,
  completeBooking,
  showPhoneVerificationPanel
};
