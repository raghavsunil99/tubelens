import { desktopMode } from "@/lib/desktop";
import { takeHandoff, validNonce } from "@/lib/desktop-handoff";

// The desktop app polls this with its secret one-time code until the browser
// sign-in finishes. Only exists in desktop mode; the code works exactly once.
export async function GET(req: Request) {
  if (!desktopMode()) return new Response(null, { status: 404 });
  const nonce = new URL(req.url).searchParams.get("nonce");
  if (!validNonce(nonce)) return new Response(null, { status: 400 });
  const handoff = takeHandoff(nonce);
  // 204 = not ready yet. A taken or expired code also reads as 204, so a wrong guess learns nothing.
  if (!handoff) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  return Response.json(handoff, { headers: { "Cache-Control": "no-store" } });
}
