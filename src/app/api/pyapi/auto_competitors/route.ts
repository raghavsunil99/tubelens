import { getCompetitors } from "@/lib/data";

export async function POST(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 8);
  const competitors = (await getCompetitors()).slice(0, limit);
  return Response.json({
    competitors,
    niche: "Tech",
    sub_niche: "Smartphones",
    language: "en",
    niche_topics: ["budget phones", "unboxing", "camera tests"],
  });
}
