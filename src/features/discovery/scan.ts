import "server-only";

// A "topic scan" is one YouTube search plus the stats of the videos and
// channels it returns. It costs about 102 quota units, so results are cached
// for a day and shared by Outliers, Keywords and the Feed.
import { cached, peekCache, type Cached } from "@/lib/cache";
import { wouldExceed } from "@/lib/quota";
import { fail, ok, type Result } from "@/lib/result";
import { terms } from "@/lib/text";
import { publicAuth, type Viewer } from "@/lib/viewer";
import { listChannels, listVideos, searchVideoIds } from "@/lib/youtube/client";
import type { ScanVideo } from "@/lib/youtube/types";
import { demoScan } from "@/demo/fixtures";
import { problemFrom } from "@/features/channel/data";

export interface ScanOptions {
  q: string;
  /** viewCount finds breakout videos; relevance shows who ranks for a phrase. */
  order: "viewCount" | "relevance";
  /** Only videos published in the last N days. 0 = any time. */
  days?: number;
  categoryId?: string;
  language?: string;
}

export interface Scan {
  videos: ScanVideo[];
  /** Shown to the creator when the results need a caveat. */
  note?: string;
}

const SCAN_TTL_SEC = 24 * 3600;
const SCAN_COST = 104;

const cacheKey = (o: ScanOptions) =>
  `scan:v1:${o.order}:${o.days ?? 0}:${o.categoryId ?? ""}:${o.language ?? ""}:${o.q.trim().toLowerCase()}`;

function demo(o: ScanOptions): Scan {
  const all = demoScan();
  const wanted = terms(o.q);
  const hits = all.filter((v) => {
    const hay = new Set([...terms(v.title), ...v.tags.flatMap((t) => terms(t))]);
    return wanted.some((w) => hay.has(w));
  });
  let videos = hits.length >= 8 ? hits : all;
  if (o.language) videos = videos.filter((v) => v.language === o.language);
  if (o.days) videos = videos.filter((v) => Date.now() - new Date(v.publishedAt).getTime() <= o.days! * 86400_000);
  return {
    videos,
    note: hits.length >= 8 ? undefined : "Demo mode has one fixed sample of videos, so it shows the same set whatever you search for.",
  };
}

/** A cached scan if one exists. Never spends quota. */
export function peekScan(viewer: Viewer, o: ScanOptions): Cached<ScanVideo[]> | null {
  if (viewer.mode === "demo") return { value: demo(o).videos, fetchedAt: new Date().toISOString(), fromCache: true };
  return peekCache<ScanVideo[]>(cacheKey(o));
}

export async function scanTopic(viewer: Viewer, o: ScanOptions): Promise<Result<Scan>> {
  if (viewer.mode === "demo") return ok("demo", demo(o));

  const auth = publicAuth(viewer);
  if (!auth) {
    return fail(
      viewer.oauthReady ? "disconnected" : "not_configured",
      viewer.oauthReady
        ? "Connect YouTube to search real videos."
        : "Searching YouTube needs YOUTUBE_API_KEY (or a connected channel) on this server.",
    );
  }
  const key = cacheKey(o);
  if (!peekCache(key) && wouldExceed(SCAN_COST)) {
    return fail("quota", "Today's YouTube API quota is nearly used up, so new searches are paused. Searches you've already run still open from the saved copy.");
  }

  try {
    const hit = await cached(key, SCAN_TTL_SEC, async () => {
      const ids = await searchVideoIds(
        {
          q: o.q,
          order: o.order,
          publishedAfter: o.days ? new Date(Date.now() - o.days * 86400_000).toISOString() : undefined,
          categoryId: o.categoryId,
          language: o.language,
          maxResults: 50,
        },
        auth,
      );
      if (ids.length === 0) return [];
      const videos = await listVideos(ids, auth);
      const channels = await listChannels([...new Set(videos.map((v) => v.channelId))], auth);
      const byId = new Map(channels.map((c) => [c.id, c]));
      return videos.flatMap((v): ScanVideo[] => {
        const c = byId.get(v.channelId);
        return c
          ? [{ ...v, channel: { id: c.id, title: c.title, subscribers: c.subscribers, totalViews: c.totalViews, videoCount: c.videoCount, country: c.country } }]
          : [];
      });
    });
    return ok("youtube", { videos: hit.value }, { fetchedAt: hit.fetchedAt, fromCache: hit.fromCache });
  } catch (err) {
    return problemFrom(err, "scan");
  }
}
