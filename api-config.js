// API configuration for local and production use.
// If your backend is deployed separately, set window.API_ORIGIN in HTML.
const LOCAL_API_ORIGIN = 'http://localhost:3000';
const DEFAULT_API_ORIGIN = window.API_ORIGIN || (window.location.protocol === 'file:' ? LOCAL_API_ORIGIN : window.location.origin);

export const API_BASE = `${DEFAULT_API_ORIGIN.replace(/\/$/, '')}/api`;
