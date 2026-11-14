import { timingSafeEqual } from "node:crypto";
import { syncAllChannels } from "@/features/channel/sync";

// Scheduled sync. Call once a day from any scheduler:
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/sync
// Uses the server's API key and stores public numbers only; no user tokens are involved.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const key = process.env.YOUTUBE_API_KEY;
  if (!secret || !key) {
    return Response.json({ error: "Scheduled sync needs CRON_SECRET and YOUTUBE_API_KEY." }, { status: 503 });
  }
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await syncAllChannels({ kind: "key", key }));
}
