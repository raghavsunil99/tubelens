import { NextResponse, type NextRequest } from "next/server";
import { refreshAccessToken } from "@/lib/google-oauth";
import { SESSION_COOKIE, sealSession, sessionCookieOptions, unsealSession } from "@/lib/session";

// Refreshes the Google access token shortly before it expires, so pages and
// API routes always see a usable token. Server components can't set cookies,
// which is why this lives here.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export async function middleware(req: NextRequest) {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw || !process.env.SESSION_SECRET) return NextResponse.next();

  const session = await unsealSession(raw);
  if (!session) {
    const res = NextResponse.next();
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if (session.expiresAt - Date.now() > REFRESH_MARGIN_MS || !session.refreshToken) {
    return NextResponse.next();
  }

  try {
    const tokens = await refreshAccessToken(session.refreshToken);
    const updated = {
      ...session,
      accessToken: tokens.access_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      refreshToken: tokens.refresh_token ?? session.refreshToken,
    };
    const sealed = await sealSession(updated);
    // Forward the new cookie to this request's handlers too.
    req.cookies.set(SESSION_COOKIE, sealed);
    const res = NextResponse.next({ request: { headers: req.headers } });
    res.cookies.set(SESSION_COOKIE, sealed, sessionCookieOptions);
    return res;
  } catch (err) {
    // Refresh token revoked or expired: sign the user out.
    console.error(err);
    const res = NextResponse.next();
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}

export const config = {
  // Skip static assets and the auth routes themselves.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
