import { getOutliers } from "@/lib/data";

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const videoType = p.get("video_type");
  const { source, data } = await getOutliers({
    q: p.get("title_search_query") ?? undefined,
    videoType: videoType === "short" || videoType === "long" ? videoType : "all",
    minScore: Number(p.get("min_score") ?? 1),
  });
  const pageSize = Math.min(100, Number(p.get("page_size") ?? 24));
  const page = Math.max(1, Number(p.get("page") ?? 1));
  return Response.json({
    source,
    data: data.slice((page - 1) * pageSize, page * pageSize),
    total: data.length,
  });
}
