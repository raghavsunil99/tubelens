import { NextResponse, type NextRequest } from "next/server";
import { appUrl, decodeIdToken, exchangeCode } from "@/lib/google-oauth";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  sealSession,
  sessionCookieOptions,
  type Session,
} from "@/lib/session";
import { getMyChannel } from "@/lib/youtube-user";

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
      channel: channel ? { id: channel.id, title: channel.title, thumbnail: channel.thumbnail } : null,
    };
  } catch (err) {
    console.error(err);
    return fail("token_exchange_failed");
  }

  const res = NextResponse.redirect(`${appUrl()}/feed${session.channel ? "" : "?auth_error=no_channel"}`);
  res.cookies.set(SESSION_COOKIE, await sealSession(session), sessionCookieOptions);
  res.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth" });
  return res;
}
