import { NextResponse, type NextRequest } from "next/server";
import { cookieSecure, DESKTOP_NONCE_COOKIE, desktopMode } from "@/lib/desktop";
import { validNonce } from "@/lib/desktop-handoff";
import { appUrl, buildAuthUrl } from "@/lib/google-oauth";
import { OAUTH_STATE_COOKIE, oauthConfigured } from "@/lib/session";

// Starts the "Connect YouTube" flow: set a CSRF state cookie, then send the
// browser to Google's consent screen. The desktop app adds ?desktop=<code> so
// the finished session can be handed back to it (see lib/desktop-handoff.ts).
export async function GET(req: NextRequest) {
  if (!oauthConfigured()) {
    return NextResponse.redirect(`${appUrl()}/feed?auth_error=not_configured`);
  }
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthUrl(state));
  const cookie = { httpOnly: true, secure: cookieSecure(), sameSite: "lax" as const, path: "/api/auth", maxAge: 600 };
  res.cookies.set(OAUTH_STATE_COOKIE, state, cookie);
  const nonce = req.nextUrl.searchParams.get("desktop");
  if (desktopMode() && validNonce(nonce)) res.cookies.set(DESKTOP_NONCE_COOKIE, nonce, cookie);
  return res;
}
