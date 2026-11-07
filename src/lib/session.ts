// Encrypted cookie session (AES-GCM via Web Crypto, so it works in both the
// Node and Edge runtimes, including middleware). Holds the user's Google
// tokens and a small channel summary until a database exists.

export const SESSION_COOKIE = "tl_session";
export const OAUTH_STATE_COOKIE = "tl_oauth_state";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface Session {
  accessToken: string;
  refreshToken?: string;
  /** epoch ms */
  expiresAt: number;
  user: { email?: string; name?: string };
  channel: { id: string; title: string; thumbnail?: string } | null;
}

let keyPromise: Promise<CryptoKey> | null = null;

function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters (see .env.example)");
  }
  keyPromise ??= crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(secret))
    .then((raw) => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]));
  return keyPromise;
}

function toB64Url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(str: string) {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export async function sealSession(session: Session): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(session));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getKey(), data));
  return `${toB64Url(iv)}.${toB64Url(ct)}`;
}

export async function unsealSession(value: string | undefined): Promise<Session | null> {
  if (!value) return null;
  try {
    const [iv, ct] = value.split(".");
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64Url(iv) },
      await getKey(),
      fromB64Url(ct),
    );
    return JSON.parse(new TextDecoder().decode(pt)) as Session;
  } catch {
    // Tampered, malformed, or encrypted with an old secret.
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

export function oauthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.SESSION_SECRET,
  );
}
