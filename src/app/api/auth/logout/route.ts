import { NextResponse, type NextRequest } from "next/server";
import { appUrl, revokeToken } from "@/lib/google-oauth";
import { logEvent } from "@/lib/log";
import { MODE_COOKIE } from "@/lib/mode";
import { SESSION_COOKIE, unsealSession } from "@/lib/session";

// Disconnect: revoke TubeLens's access with Google, then clear the session.
// POST only, so a link or image on another site can't sign the user out.
export async function POST(req: NextRequest) {
  const session = await unsealSession(req.cookies.get(SESSION_COOKIE)?.value);
  // Revoking the refresh token also revokes the access tokens issued from it.
  const token = session?.refreshToken ?? session?.accessToken;
  if (token) await revokeToken(token);
  logEvent("info", "oauth.disconnected", { revoked: Boolean(token) });
  const res = NextResponse.redirect(`${appUrl()}/settings?disconnected=1`, { status: 303 });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(MODE_COOKIE);
  return res;
}
