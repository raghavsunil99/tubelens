import { getFeedInbox } from "@/lib/data";

export async function GET(req: Request) {
  const channelId = new URL(req.url).searchParams.get("channelId") ?? undefined;
  return Response.json(await getFeedInbox(channelId));
}
