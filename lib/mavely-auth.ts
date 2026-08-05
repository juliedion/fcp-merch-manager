/**
 * Minimal shared-password gate. One password (APP_PASSWORD) protects the whole app.
 * Uses Web Crypto (available in both the Node and Edge runtimes) instead of the
 * Node `crypto` module so this works from middleware.ts on the Edge runtime.
 */

export const SESSION_COOKIE_NAME = "fcp_session";

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Deterministic session token derived from the shared password + a static app-level salt. */
export async function expectedSessionToken(): Promise<string | null> {
  const password = process.env.APP_PASSWORD;
  if (!password) return null;
  return sha256Hex(`fcp-merch-manager:${password}`);
}

export async function isValidPassword(candidate: string): Promise<boolean> {
  const password = process.env.APP_PASSWORD;
  if (!password) return false;
  return candidate === password;
}
