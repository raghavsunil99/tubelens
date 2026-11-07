import "server-only";

// Minimal YouTube Data API v3 client. Active only when YOUTUBE_API_KEY is set;
// otherwise every function returns null and callers fall back to mock data.
//
// Quota costs (default 10,000 units/day): search.list = 100, videos.list = 1,
// channels.list = 1. Cache aggressively before shipping anything public.

const BASE = "https://www.googleapis.com/youtube/v3";

export function youtubeEnabled() {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

async function yt<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", process.env.YOUTUBE_API_KEY!);
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`YouTube ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

interface YtChannel {
  id: string;
  snippet: {
    title: string;
    customUrl?: string;
    description: string;
    country?: string;
    defaultLanguage?: string;
    thumbnails: { default?: { url: string }; medium?: { url: string } };
  };
  statistics: {
    viewCount: string;
    subscriberCount?: string;
    hiddenSubscriberCount: boolean;
    videoCount: string;
  };
}

interface YtVideo {
  id: string;
  snippet: {
    title: string;
    publishedAt: string;
    channelId: string;
    channelTitle: string;
    categoryId: string;
    defaultAudioLanguage?: string;
    thumbnails: { medium?: { url: string }; high?: { url: string } };
  };
  statistics: { viewCount?: string };
  contentDetails: { duration: string };
}

export async function getChannels(ids: string[]) {
  if (!youtubeEnabled() || ids.length === 0) return null;
  const data = await yt<{ items?: YtChannel[] }>("channels", {
    part: "snippet,statistics",
    id: ids.slice(0, 50).join(","),
  });
  return data.items ?? [];
}

export async function searchChannels(q: string, maxResults = 12) {
  if (!youtubeEnabled()) return null;
  const s = await yt<{ items?: { id: { channelId: string } }[] }>("search", {
    part: "id",
    type: "channel",
    q,
    maxResults: String(maxResults),
  });
  const ids = (s.items ?? []).map((i) => i.id.channelId);
  return getChannels(ids);
}

/** Searches videos for a query and scores each against its channel's average views. */
export async function searchVideosWithChannelAverages(q: string, maxResults = 25) {
  if (!youtubeEnabled()) return null;
  const s = await yt<{ items?: { id: { videoId: string } }[] }>("search", {
    part: "id",
    type: "video",
    q,
    order: "viewCount",
    publishedAfter: new Date(Date.now() - 90 * 86400_000).toISOString(),
    maxResults: String(maxResults),
  });
  const videoIds = (s.items ?? []).map((i) => i.id.videoId);
  if (videoIds.length === 0) return [];
  const v = await yt<{ items?: YtVideo[] }>("videos", {
    part: "snippet,statistics,contentDetails",
    id: videoIds.join(","),
  });
  const videos = v.items ?? [];
  const channels = (await getChannels([...new Set(videos.map((x) => x.snippet.channelId))])) ?? [];
  const byId = new Map(channels.map((c) => [c.id, c]));
  return videos.map((video) => ({ video, channel: byId.get(video.snippet.channelId) }));
}

/** ISO-8601 duration (PT1H2M3S) → seconds. */
export function parseDuration(iso: string) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export type { YtChannel, YtVideo };
