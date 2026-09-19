// Thin fetch wrapper for the Kofa backend.
//
// Responsibilities:
//  - prefix requests with the configured base URL
//  - attach the bearer access token once the user has logged in
//  - attach x-idempotency-key on clinical mutations
//  - normalise error responses into a thrown Error with a readable message

import { API_BASE_URL } from "./config";

const TOKEN_KEY = "smartcare-access-token";

let accessToken = null;

try {
  accessToken = sessionStorage.getItem(TOKEN_KEY) || null;
} catch {
  accessToken = null;
}

export function setAccessToken(token) {
  accessToken = token || null;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // sessionStorage may be unavailable (private mode); in-memory token still works.
  }
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  setAccessToken(null);
}

// A reasonably unique idempotency key for clinical mutations (>= 16 chars).
export function newIdempotencyKey(prefix = "sc") {
  const random = Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now().toString(36)}-${random}`.padEnd(16, "0");
}

export async function apiFetch(path, { method = "GET", body, idempotencyKey, auth = true } = {}) {
  const headers = { Accept: "application/json" };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (idempotencyKey) {
    headers["x-idempotency-key"] = idempotencyKey;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Unable to reach the SmartCare backend. Check that the API is running.");
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      (response.status === 401
        ? "Your session has expired. Please sign in again."
        : response.status === 403
          ? "You are not authorized for this action."
          : `Request failed (${response.status}).`);
    const error = new Error(Array.isArray(message) ? message.join(", ") : message);
    error.status = response.status;
    error.code = payload?.code;
    throw error;
  }

  return payload;
}
