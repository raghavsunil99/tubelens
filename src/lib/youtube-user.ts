import "server-only";

// Calls made on behalf of the signed-in user with their OAuth access token.
// Scopes: youtube.readonly (channel + uploads) and yt-analytics.readonly.
import type { ChannelStats, OptimizeVideo } from "./types";
import { parseDuration } from "./youtube";

const YT = "https://www.googleapis.com/youtube/v3";
const YTA = "https://youtubeanalytics.googleapis.com/v2/reports";

async function get<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    // Per-user data: never put it in Next's shared fetch cache.
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${new URL(url).pathname} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export interface MyChannel {
  id: string;
  title: string;
  thumbnail?: string;
  uploadsPlaylistId: string;
  viewCount: number;
  subscriberCount: number;
  videoCount: number;
}

/** The authenticated user's own channel, or null if the Google account has none. */
export async function getMyChannel(token: string): Promise<MyChannel | null> {
  const data = await get<{
    items?: {
      id: string;
      snippet: { title: string; thumbnails: { default?: { url: string } } };
      statistics: { viewCount: string; subscriberCount?: string; videoCount: string };
      contentDetails: { relatedPlaylists: { uploads: string } };
    }[];
  }>(`${YT}/channels?part=snippet,statistics,contentDetails&mine=true`, token);
  const c = data.items?.[0];
  if (!c) return null;
  return {
    id: c.id,
    title: c.snippet.title,
    thumbnail: c.snippet.thumbnails.default?.url,
    uploadsPlaylistId: c.contentDetails.relatedPlaylists.uploads,
    viewCount: Number(c.statistics.viewCount),
    subscriberCount: Number(c.statistics.subscriberCount ?? 0),
    videoCount: Number(c.statistics.videoCount),
  };
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Current lifetime totals from the Data API, and "previous" = totals 28 days
 * ago, derived by subtracting the last 28 days of Analytics deltas.
 */
export async function getMyChannelStats(token: string, channel: MyChannel): Promise<ChannelStats> {
  const end = new Date();
  const start = new Date(Date.now() - 28 * 86400_000);
  let views = 0;
  let netSubs = 0;
  try {
    const report = await get<{ rows?: number[][] }>(
      `${YTA}?ids=channel==MINE&startDate=${ymd(start)}&endDate=${ymd(end)}&metrics=views,subscribersGained,subscribersLost`,
      token,
    );
    const [v = 0, gained = 0, lost = 0] = report.rows?.[0] ?? [];
    views = v;
    netSubs = gained - lost;
  } catch (err) {
    // Analytics can be unavailable for brand-new or tiny channels.
    console.error(err);
  }
  let newVideos = 0;
  try {
    const recent = await getMyRecentUploads(token, channel, 50);
    newVideos = recent.filter((v) => new Date(v.publishedAt) >= start).length;
  } catch (err) {
    console.error(err);
  }
  return {
    channelId: channel.id,
    current: {
      viewCount: channel.viewCount,
      subscriberCount: channel.subscriberCount,
      videoCount: channel.videoCount,
    },
    previous: {
      viewCount: channel.viewCount - views,
      subscriberCount: channel.subscriberCount - netSubs,
      videoCount: channel.videoCount - newVideos,
    },
  };
}

/** Most recent uploads with statistics. Title/thumbnail scores stay null until a scoring model exists. */
export async function getMyRecentUploads(token: string, channel: MyChannel, max = 20): Promise<OptimizeVideo[]> {
  const pl = await get<{ items?: { contentDetails: { videoId: string } }[] }>(
    `${YT}/playlistItems?part=contentDetails&maxResults=${Math.min(50, max)}&playlistId=${channel.uploadsPlaylistId}`,
    token,
  );
  const ids = (pl.items ?? []).map((i) => i.contentDetails.videoId);
  if (ids.length === 0) return [];
  const v = await get<{
    items?: {
      id: string;
      snippet: { title: string; publishedAt: string; thumbnails: { medium?: { url: string } } };
      statistics: { viewCount?: string };
      contentDetails: { duration: string };
    }[];
  }>(`${YT}/videos?part=snippet,statistics,contentDetails&id=${ids.join(",")}`, token);
  return (v.items ?? []).map((item) => ({
    id: item.id,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails.medium?.url ?? "",
    publishedAt: item.snippet.publishedAt,
    viewCount: Number(item.statistics.viewCount ?? 0),
    titleScore: null,
    thumbnailScore: null,
    // Shorts can be up to 3 minutes; duration alone is a heuristic.
    videoType: parseDuration(item.contentDetails.duration) <= 180 ? "short" : "long",
  }));
}
