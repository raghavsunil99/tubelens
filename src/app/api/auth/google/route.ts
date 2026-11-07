import { NextResponse } from "next/server";
import { appUrl, buildAuthUrl } from "@/lib/google-oauth";
import { OAUTH_STATE_COOKIE, oauthConfigured } from "@/lib/session";

// Starts the "Connect YouTube" flow: set a CSRF state cookie, then send the
// browser to Google's consent screen.
export async function GET() {
  if (!oauthConfigured()) {
    return NextResponse.redirect(`${appUrl()}/feed?auth_error=not_configured`);
  }
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 600,
  });
  return res;
}
