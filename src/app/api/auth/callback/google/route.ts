import { NextResponse, type NextRequest } from "next/server";
import { appUrl, decodeIdToken, exchangeCode } from "@/lib/google-oauth";
import { logEvent } from "@/lib/log";
import { MODE_COOKIE } from "@/lib/mode";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  sealSession,
  sessionCookieOptions,
  type Session,
} from "@/lib/session";
import { getPrefs } from "@/lib/viewer";
import { getMyChannel } from "@/lib/youtube/client";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const fail = (reason: string) => {
    const res = NextResponse.redirect(`${appUrl()}/feed?auth_error=${encodeURIComponent(reason)}`);
    res.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth" });
    return res;
  };

  // User clicked "Cancel" on Google's screen, or Google rejected the request.
  if (params.get("error")) return fail(params.get("error")!);

  const state = params.get("state");
  const expected = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!state || !expected || state !== expected) return fail("state_mismatch");

  const code = params.get("code");
  if (!code) return fail("missing_code");

  let session: Session;
  try {
    const tokens = await exchangeCode(code);
    const granted = tokens.scope.split(" ");
    if (!granted.includes("https://www.googleapis.com/auth/youtube.readonly")) {
      return fail("youtube_scope_denied");
    }
    const channel = await getMyChannel(tokens.access_token);
    session = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      user: decodeIdToken(tokens.id_token),
      channel: channel ? { id: channel.id, title: channel.title, thumbnail: channel.thumbnail ?? undefined } : null,
    };
  } catch (err) {
    logEvent("error", "oauth.token_exchange_failed", err);
    return fail("token_exchange_failed");
  }

  // First-time creators go through setup; returning ones land on their feed.
  let next = "/feed?auth_error=no_channel";
  if (session.channel) {
    let onboarded = false;
    try {
      onboarded = Boolean(getPrefs(`ch:${session.channel.id}`).onboardedAt);
    } catch (err) {
      logEvent("warn", "oauth.prefs_lookup_failed", err);
    }
    next = onboarded ? "/feed" : "/onboarding?step=2";
  }
  logEvent("info", "oauth.connected", { hasChannel: Boolean(session.channel) });

  const res = NextResponse.redirect(`${appUrl()}${next}`);
  res.cookies.set(SESSION_COOKIE, await sealSession(session), sessionCookieOptions);
  res.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth" });
  // Connecting a channel means the creator wants their own data, not the demo.
  if (session.channel) {
    res.cookies.set(MODE_COOKIE, "live", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MAX_AGE });
  }
  return res;
}
