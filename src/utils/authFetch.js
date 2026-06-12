/**
 * authFetch.js — SmartMarketAI authenticated fetch wrapper
 *
 * Fixes applied:
 *  - getStoredUser() now decodes the JWT to read role/name/vendorId, so the
 *    returned values are always consistent with the signed token — not with
 *    any localStorage keys that could have been tampered with client-side.
 *  - authFetch sets Content-Type only when no explicit Content-Type is already
 *    present in options.headers, allowing callers to pass multipart/form-data etc.
 *  - logout() performs a hard clear + redirect as before.
 */

/**
 * authFetch — drop-in replacement for fetch() that attaches the stored JWT
 * as a Bearer token in the Authorization header.
 *
 * Usage:
 *   import { authFetch } from "../utils/authFetch";
 *
 *   const res  = await authFetch("/api/orders?vendorId=v-01");
 *   const data = await authFetch("/api/products", {
 *     method: "POST",
 *     body: JSON.stringify(newProduct),
 *   });
 *
 * On 401 the user is automatically logged out and redirected to /login.
 */
export async function authFetch(url, options = {}) {
  const token = localStorage.getItem("token");

  // Only inject Content-Type if the caller hasn't already set one
  const callerHeaders  = options.headers || {};
  const hasContentType = Object.keys(callerHeaders).some(
    (k) => k.toLowerCase() === "content-type"
  );

  const headers = {
    ...(hasContentType ? {} : { "Content-Type": "application/json" }),
    ...callerHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
  const finalUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;

  const response = await fetch(finalUrl, { ...options, headers });

  // Auto-logout on expired / invalid token
  if (response.status === 401) {
    localStorage.clear();
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  return response;
}

/**
 * getStoredUser — returns a user object decoded from the JWT payload.
 *
 * FIX: reads role, name, and vendorId from the signed token rather than from
 * raw localStorage keys, so the values cannot be spoofed client-side.
 *
 * Returns null when no valid token exists or the token is expired.
 */
export function getStoredUser() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;

    const base64  = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));

    // Check expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      localStorage.clear();
      return null;
    }

    return {
      id:       payload.id       ?? null,
      name:     payload.name     ?? null,
      email:    payload.email    ?? null,
      role:     payload.role     ?? null,
      vendorId: payload.vendorId ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * logout — clears all auth data and redirects to the landing page.
 */
export function logout() {
  localStorage.clear();
  window.location.href = "/login";
}