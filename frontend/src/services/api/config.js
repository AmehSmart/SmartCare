// Central switch between the built-in mock data and the real Kofa backend.
//
// When VITE_API_BASE_URL is set (see .env.example) the service layer talks to
// the live API. When it is blank/undefined every service falls back to the
// original mock implementation, so the prototype still runs with no backend.

const rawBaseUrl = import.meta.env?.VITE_API_BASE_URL ?? "http://localhost:3000";
const mockMode = import.meta.env?.VITE_USE_MOCK_DATA === "true";

export const API_BASE_URL = String(rawBaseUrl).trim().replace(/\/+$/, "");

export function isBackendEnabled() {
  return !mockMode && API_BASE_URL.length > 0;
}

export function isMockMode() {
  return mockMode;
}
