import { getSession } from "@/lib/auth";
import { getChannelStats } from "@/lib/data";

export async function GET() {
  const { source, data } = await getChannelStats(await getSession());
  return Response.json({ source, ...data });
}
