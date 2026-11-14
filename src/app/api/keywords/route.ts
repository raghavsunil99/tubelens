import { getKeyword } from "@/features/keywords/data";
import { getViewer } from "@/lib/viewer";
import { statusFor } from "../respond";

// GET /api/keywords?q=best+phone+under+15000
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!q) return Response.json({ ok: false, problem: { kind: "error", message: "Pass a keyword as ?q=" } }, { status: 400 });
  const result = await getKeyword(await getViewer(), q);
  return Response.json(result, { status: statusFor(result) });
}
