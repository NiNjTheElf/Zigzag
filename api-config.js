// API configuration for local and production use.
// If your backend is deployed separately, set window.API_ORIGIN in HTML.
const LOCAL_API_ORIGIN = 'http://localhost:3000';
const PRODUCTION_API_ORIGIN = 'https://zigzag-production-d5c3.up.railway.app';

function resolveApiOrigin() {
  if (window.API_ORIGIN) return window.API_ORIGIN;
  if (window.location.protocol === 'file:') return LOCAL_API_ORIGIN;

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  if (isLocalhost) {
    return window.location.port === '3000' ? window.location.origin : LOCAL_API_ORIGIN;
  }

  const isFirebaseHosting = hostname.endsWith('.web.app') || hostname.endsWith('.firebaseapp.com');
  if (isFirebaseHosting) return PRODUCTION_API_ORIGIN;

  return window.location.origin;
}

const DEFAULT_API_ORIGIN = resolveApiOrigin();

export const API_BASE = `${DEFAULT_API_ORIGIN.replace(/\/$/, '')}/api`;
