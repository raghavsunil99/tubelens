import { getConversations } from "@/lib/data";

export async function GET() {
  return Response.json({ conversations: await getConversations(), poll_after_seconds: 30 });
}
