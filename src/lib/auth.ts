import "server-only";

import { cookies } from "next/headers";
import { SESSION_COOKIE, unsealSession, type Session } from "./session";

/** The current user's session for server components and route handlers, or null when signed out. */
export async function getSession(): Promise<Session | null> {
  if (!process.env.SESSION_SECRET) return null;
  const jar = await cookies();
  const session = await unsealSession(jar.get(SESSION_COOKIE)?.value);
  // Middleware refreshes tokens before this point; an expired token here means
  // there was no refresh token, so treat the user as signed out.
  if (!session || session.expiresAt <= Date.now()) return null;
  return session;
}
