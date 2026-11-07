import { NextResponse, type NextRequest } from "next/server";
import { appUrl, revokeToken } from "@/lib/google-oauth";
import { SESSION_COOKIE, unsealSession } from "@/lib/session";

// POST only, so a link or image on another site can't sign the user out.
export async function POST(req: NextRequest) {
  const session = await unsealSession(req.cookies.get(SESSION_COOKIE)?.value);
  // Revoking the refresh token also revokes the access tokens issued from it.
  const token = session?.refreshToken ?? session?.accessToken;
  if (token) await revokeToken(token);
  const res = NextResponse.redirect(`${appUrl()}/feed`, { status: 303 });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
