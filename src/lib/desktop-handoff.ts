import "server-only";

// The desktop app signs in through the system browser (Google refuses to show
// its sign-in page inside an embedded window). The browser finishes the OAuth
// flow against this local server, which parks the finished session here under
// a secret one-time code that only the desktop app knows. The app collects it
// once and installs it in its own window. Nothing here is written to disk.

interface Handoff {
  session: string;
  next: string;
  expires: number;
}

const TTL_MS = 5 * 60_000;
const holder = globalThis as unknown as { __tubelensHandoffs?: Map<string, Handoff> };
const store = () => (holder.__tubelensHandoffs ??= new Map());

/** A code is 64 hex characters (32 random bytes). Anything else is refused. */
export const validNonce = (n: unknown): n is string => typeof n === "string" && /^[a-f0-9]{64}$/.test(n);

export function putHandoff(nonce: string, session: string, next: string) {
  const now = Date.now();
  for (const [k, v] of store()) if (v.expires <= now) store().delete(k);
  store().set(nonce, { session, next, expires: now + TTL_MS });
}

/** Returns the parked session once, then forgets it. */
export function takeHandoff(nonce: string): { session: string; next: string } | null {
  const h = store().get(nonce);
  store().delete(nonce);
  return h && h.expires > Date.now() ? { session: h.session, next: h.next } : null;
}
