import { getKeywordTrends } from "@/lib/data";

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const topic = p.get("topic") ?? "all";
  const limit = Number(p.get("limit") ?? 50);
  const keywords = (await getKeywordTrends(topic)).slice(0, limit);
  return Response.json({ keywords, period: p.get("period") ?? "7d", topic });
}
