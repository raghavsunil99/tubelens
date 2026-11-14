import "server-only";

import { cached, peekCache } from "@/lib/cache";
import { wouldExceed } from "@/lib/quota";
import { fail, ok, type Result } from "@/lib/result";
import { publicAuth, type Viewer } from "@/lib/viewer";
import { listChannels, searchChannelIds } from "@/lib/youtube/client";
import type { Channel } from "@/lib/youtube/types";
import { demoCompetitors, demoScan } from "@/demo/fixtures";
import { problemFrom } from "@/features/channel/data";

/** Channel search for the research page. One search costs 100 quota units and is cached for a day. */
export async function searchChannels(viewer: Viewer, q: string): Promise<Result<Channel[]>> {
  if (viewer.mode === "demo") {
    const tracked = new Map(demoCompetitors().map((c) => [c.channel.id, c.channel]));
    const seen = new Map<string, Channel>();
    for (const v of demoScan()) {
      if (seen.has(v.channel.id)) continue;
      seen.set(
        v.channel.id,
        tracked.get(v.channel.id) ?? {
          id: v.channel.id,
          title: v.channel.title,
          handle: null,
          thumbnail: null,
          country: v.channel.country,
          uploadsPlaylistId: null,
          subscribers: v.channel.subscribers,
          totalViews: v.channel.totalViews,
          videoCount: v.channel.videoCount,
        },
      );
    }
    return ok("demo", [...seen.values()]);
  }
  const auth = publicAuth(viewer);
  if (!auth) {
    return fail(
      viewer.oauthReady ? "disconnected" : "not_configured",
      viewer.oauthReady ? "Connect YouTube to search real channels." : "Searching YouTube needs YOUTUBE_API_KEY (or a connected channel) on this server.",
    );
  }
  const key = `channels:v1:${q.trim().toLowerCase()}`;
  if (!peekCache(key) && wouldExceed(101)) return fail("quota", "Today's YouTube API quota is nearly used up, so new searches are paused.");
  try {
    const hit = await cached(key, 24 * 3600, async () => listChannels(await searchChannelIds(q, auth), auth));
    return ok("youtube", hit.value, { fetchedAt: hit.fetchedAt, fromCache: hit.fromCache });
  } catch (err) {
    return problemFrom(err, "channels.search");
  }
}
