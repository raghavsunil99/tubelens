import { NextResponse, type NextRequest } from "next/server";
import { refreshAccessToken } from "@/lib/google-oauth";
import { cookieSecure } from "@/lib/desktop";
import { ANON_COOKIE } from "@/lib/mode";
import { redact } from "@/lib/redact";
import { SESSION_COOKIE, SESSION_MAX_AGE, sealSession, sessionCookieOptions, unsealSession } from "@/lib/session";

// 1. Gives every browser a random anonymous id, so Demo-mode saves and
//    preferences belong to that browser only.
// 2. Refreshes the Google access token shortly before it expires, so pages and
//    API routes always see a usable token. Server components can't set cookies,
//    which is why this lives here.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export async function middleware(req: NextRequest) {
  let newAnon: string | null = null;
  if (!req.cookies.get(ANON_COOKIE)) {
    newAnon = crypto.randomUUID();
    req.cookies.set(ANON_COOKIE, newAnon);
  }

  let newSession: string | null = null;
  let dropSession = false;
  const raw = req.cookies.get(SESSION_COOKIE)?.value;

  if (raw && process.env.SESSION_SECRET) {
    const session = await unsealSession(raw);
    if (!session) {
      dropSession = true;
    } else if (session.expiresAt - Date.now() <= REFRESH_MARGIN_MS && session.refreshToken) {
      try {
        const tokens = await refreshAccessToken(session.refreshToken);
        newSession = await sealSession({
          ...session,
          accessToken: tokens.access_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
          refreshToken: tokens.refresh_token ?? session.refreshToken,
        });
        // Forward the new cookie to this request's handlers too.
        req.cookies.set(SESSION_COOKIE, newSession);
      } catch (err) {
        // Refresh token revoked or expired: sign the user out.
        console.error(`[tubelens] oauth.refresh_failed ${redact(err)}`);
        dropSession = true;
      }
    }
  }

  if (dropSession) req.cookies.delete(SESSION_COOKIE);
  const res = NextResponse.next({ request: { headers: req.headers } });
  if (newAnon) {
    res.cookies.set(ANON_COOKIE, newAnon, {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE * 12,
    });
  }
  if (newSession) res.cookies.set(SESSION_COOKIE, newSession, sessionCookieOptions);
  if (dropSession) res.cookies.delete(SESSION_COOKIE);
  return res;
}

export const config = {
  // Skip static assets and the auth routes themselves.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
