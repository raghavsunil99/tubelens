import { getSession } from "@/lib/auth";
import { getOptimizeVideos } from "@/lib/data";

export async function GET() {
  const { source, data } = await getOptimizeVideos(await getSession());
  return Response.json({ source, data, nextPageToken: null });
}
