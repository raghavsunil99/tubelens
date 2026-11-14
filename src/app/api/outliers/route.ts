import { getOutliers } from "@/features/outliers/data";
import { getViewer } from "@/lib/viewer";
import { statusFor } from "../respond";

// GET /api/outliers?q=budget+phones&type=long&days=30&minSubs=1000&minScore=3
// The response always says whether it is `youtube` or `demo` data.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const q = (p.get("q") ?? "").trim().slice(0, 100);
  if (!q) return Response.json({ ok: false, problem: { kind: "error", message: "Pass a topic as ?q=" } }, { status: 400 });
  const type = p.get("type");
  const num = (key: string, fallback: number) => (Number.isFinite(Number(p.get(key))) && p.get(key) ? Number(p.get(key)) : fallback);
  const result = await getOutliers(await getViewer(), {
    q,
    type: type === "short" || type === "long" ? type : "all",
    days: Math.min(365, Math.max(0, num("days", 90))),
    minSubs: Math.max(0, num("minSubs", 0)),
    minScore: Math.max(1, num("minScore", 2)),
    language: p.get("lang")?.slice(0, 5) || undefined,
  });
  return Response.json(result, { status: statusFor(result) });
}
