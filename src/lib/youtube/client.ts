// YouTube Data API v3 + YouTube Analytics API client (read-only).
//
// Quota (default 10,000 units/day): search.list = 100, everything else here = 1.
// Every call records its cost in the quota ledger, and quota / rate-limit /
// auth failures surface as a typed YouTubeError so pages can explain them.
import { markExhausted, recordUnits, UNIT_COST } from "../quota";
import type { ProblemKind } from "../result";
import type { AnalyticsDay, Channel, Video, VideoAnalytics } from "./types";

const DATA = "https://www.googleapis.com/youtube/v3";
const ANALYTICS = "https://youtubeanalytics.googleapis.com/v2/reports";

/** An API key (public data only) or the signed-in creator's OAuth access token. */
export type YtAuth = { kind: "key"; key: string } | { kind: "token"; token: string };

export class YouTubeError extends Error {
  constructor(
    public kind: Extract<ProblemKind, "quota" | "rate_limited" | "auth" | "not_found" | "error">,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "YouTubeError";
  }
}

const QUOTA_REASONS = new Set(["quotaExceeded", "dailyLimitExceeded"]);
const RATE_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded"]);

/** Maps a Google error response to a YouTubeError. Exported for tests. */
export function toYouTubeError(status: number, body: string): YouTubeError {
  let reason = "";
  let message = "";
  try {
    const err = (JSON.parse(body) as { error?: { message?: string; errors?: { reason?: string }[] } }).error;
    reason = err?.errors?.[0]?.reason ?? "";
    message = err?.message ?? "";
  } catch {
    // Non-JSON error body.
  }
  if (QUOTA_REASONS.has(reason)) {
    return new YouTubeError("quota", "Today's YouTube API quota is used up. It resets at midnight Pacific time.", status);
  }
  if (status === 429 || RATE_REASONS.has(reason)) {
    return new YouTubeError("rate_limited", "YouTube is rate-limiting requests. Try again in a minute.", status);
  }
  if (status === 401 || status === 403) {
    return new YouTubeError("auth", message || "YouTube rejected the credentials.", status);
  }
  if (status === 404) return new YouTubeError("not_found", message || "Not found on YouTube.", status);
  return new YouTubeError("error", message || `YouTube request failed (${status}).`, status);
}

async function request<T>(url: URL, auth: YtAuth, units: number): Promise<T> {
  // The API key travels in a header, never in the URL, so it can't leak into logs.
  const headers: Record<string, string> =
    auth.kind === "token" ? { Authorization: `Bearer ${auth.token}` } : { "X-Goog-Api-Key": auth.key };
  let res: Response;
  try {
    res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new YouTubeError("error", "Couldn't reach YouTube. Check your connection and try again.");
  }
  // Google charges quota for failed calls too.
  if (units > 0) recordUnits(units);
  if (!res.ok) {
    const err = toYouTubeError(res.status, await res.text());
    if (err.kind === "quota") markExhausted();
    throw err;
  }
  return res.json() as Promise<T>;
}

function dataUrl(path: string, params: Record<string, string | undefined>) {
  const url = new URL(`${DATA}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return url;
}

/** ISO-8601 duration (PT1H2M3S) → seconds. */
export function parseDuration(iso: string) {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
}

const num = (v: string | undefined) => (v === undefined ? null : Number(v));

interface RawChannel {
  id: string;
  snippet: { title: string; customUrl?: string; country?: string; thumbnails?: { default?: { url: string } } };
  statistics: { viewCount?: string; subscriberCount?: string; hiddenSubscriberCount?: boolean; videoCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
}

function toChannel(c: RawChannel): Channel {
  return {
    id: c.id,
    title: c.snippet.title,
    handle: c.snippet.customUrl ?? null,
    thumbnail: c.snippet.thumbnails?.default?.url ?? null,
    country: c.snippet.country ?? null,
    uploadsPlaylistId: c.contentDetails?.relatedPlaylists?.uploads ?? null,
    subscribers: c.statistics.hiddenSubscriberCount ? null : num(c.statistics.subscriberCount),
    totalViews: Number(c.statistics.viewCount ?? 0),
    videoCount: Number(c.statistics.videoCount ?? 0),
  };
}

interface RawVideo {
  id: string;
  snippet: {
    title: string;
    description?: string;
    tags?: string[];
    publishedAt: string;
    channelId: string;
    channelTitle: string;
    categoryId?: string;
    defaultAudioLanguage?: string;
    defaultLanguage?: string;
    thumbnails?: { medium?: { url: string }; high?: { url: string } };
  };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
}

function toVideo(v: RawVideo): Video {
  return {
    id: v.id,
    channelId: v.snippet.channelId,
    channelTitle: v.snippet.channelTitle,
    title: v.snippet.title,
    description: v.snippet.description ?? "",
    tags: v.snippet.tags ?? [],
    publishedAt: v.snippet.publishedAt,
    durationSec: parseDuration(v.contentDetails?.duration ?? ""),
    thumbnail: v.snippet.thumbnails?.medium?.url ?? v.snippet.thumbnails?.high?.url ?? null,
    categoryId: v.snippet.categoryId ?? null,
    language: v.snippet.defaultAudioLanguage ?? v.snippet.defaultLanguage ?? null,
    views: Number(v.statistics?.viewCount ?? 0),
    likes: num(v.statistics?.likeCount),
    comments: num(v.statistics?.commentCount),
  };
}

const CHANNEL_PARTS = "snippet,statistics,contentDetails";

export async function listChannels(ids: string[], auth: YtAuth): Promise<Channel[]> {
  const out: Channel[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await request<{ items?: RawChannel[] }>(
      dataUrl("channels", { part: CHANNEL_PARTS, id: ids.slice(i, i + 50).join(","), maxResults: "50" }),
      auth,
      UNIT_COST.list,
    );
    out.push(...(data.items ?? []).map(toChannel));
  }
  return out;
}

/** The signed-in creator's own channel, or null if the Google account has none. */
export async function getMyChannel(token: string): Promise<Channel | null> {
  const data = await request<{ items?: RawChannel[] }>(
    dataUrl("channels", { part: CHANNEL_PARTS, mine: "true" }),
    { kind: "token", token },
    UNIT_COST.list,
  );
  return data.items?.[0] ? toChannel(data.items[0]) : null;
}

/** Turns what a creator pastes (URL, @handle or channel id) into a lookup. Exported for tests. */
export function parseChannelInput(input: string): { id: string } | { handle: string } | null {
  const text = input.trim();
  if (!text) return null;
  const idMatch = text.match(/(?:^|\/channel\/)(UC[\w-]{22})(?:$|[/?#])/);
  if (idMatch) return { id: idMatch[1] };
  const handleMatch = text.match(/(?:^|youtube\.com\/)@([\w.-]{3,30})/i);
  if (handleMatch) return { handle: `@${handleMatch[1]}` };
  if (/^[\w.-]{3,30}$/.test(text)) return { handle: `@${text}` };
  return null;
}

export async function findChannel(input: string, auth: YtAuth): Promise<Channel | null> {
  const lookup = parseChannelInput(input);
  if (!lookup) return null;
  const data = await request<{ items?: RawChannel[] }>(
    dataUrl("channels", {
      part: CHANNEL_PARTS,
      ...("id" in lookup ? { id: lookup.id } : { forHandle: lookup.handle }),
    }),
    auth,
    UNIT_COST.list,
  );
  return data.items?.[0] ? toChannel(data.items[0]) : null;
}

export async function listVideos(ids: string[], auth: YtAuth): Promise<Video[]> {
  const out: Video[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await request<{ items?: RawVideo[] }>(
      dataUrl("videos", { part: "snippet,statistics,contentDetails", id: ids.slice(i, i + 50).join(","), maxResults: "50" }),
      auth,
      UNIT_COST.list,
    );
    out.push(...(data.items ?? []).map(toVideo));
  }
  return out;
}

/** A channel's most recent uploads, newest first (2 quota units for up to 50 videos). */
export async function listUploads(uploadsPlaylistId: string, auth: YtAuth, max = 30): Promise<Video[]> {
  const pl = await request<{ items?: { contentDetails: { videoId: string } }[] }>(
    dataUrl("playlistItems", {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: String(Math.min(50, max)),
    }),
    auth,
    UNIT_COST.list,
  );
  const ids = (pl.items ?? []).map((i) => i.contentDetails.videoId);
  if (ids.length === 0) return [];
  const videos = await listVideos(ids, auth);
  return videos.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export interface VideoSearch {
  q: string;
  order: "viewCount" | "relevance";
  publishedAfter?: string;
  categoryId?: string;
  language?: string;
  regionCode?: string;
  maxResults?: number;
}

/** search.list for videos: 100 quota units. Always cache the result. */
export async function searchVideoIds(s: VideoSearch, auth: YtAuth): Promise<string[]> {
  const data = await request<{ items?: { id: { videoId?: string } }[] }>(
    dataUrl("search", {
      part: "id",
      type: "video",
      q: s.q,
      order: s.order,
      publishedAfter: s.publishedAfter,
      videoCategoryId: s.categoryId,
      relevanceLanguage: s.language,
      regionCode: s.regionCode,
      maxResults: String(s.maxResults ?? 50),
    }),
    auth,
    UNIT_COST.search,
  );
  return (data.items ?? []).map((i) => i.id.videoId).filter((id): id is string => Boolean(id));
}

/** search.list for channels: 100 quota units. */
export async function searchChannelIds(q: string, auth: YtAuth, maxResults = 12): Promise<string[]> {
  const data = await request<{ items?: { id: { channelId?: string } }[] }>(
    dataUrl("search", { part: "id", type: "channel", q, maxResults: String(maxResults) }),
    auth,
    UNIT_COST.search,
  );
  return (data.items ?? []).map((i) => i.id.channelId).filter((id): id is string => Boolean(id));
}

// ---- YouTube Analytics (the creator's own channel only; needs their token) ----

interface Report {
  columnHeaders?: { name: string }[];
  rows?: (string | number)[][];
}

async function report(params: Record<string, string>, token: string): Promise<Record<string, string | number>[]> {
  const url = new URL(ANALYTICS);
  for (const [k, v] of Object.entries({ ids: "channel==MINE", ...params })) url.searchParams.set(k, v);
  // The Analytics API has its own, separate quota, so nothing is recorded here.
  const data = await request<Report>(url, { kind: "token", token }, 0);
  const names = (data.columnHeaders ?? []).map((h) => h.name);
  return (data.rows ?? []).map((row) => Object.fromEntries(row.map((value, i) => [names[i], value])));
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export async function getDailyAnalytics(token: string, days = 28, now = new Date()): Promise<AnalyticsDay[]> {
  const rows = await report(
    {
      startDate: ymd(new Date(now.getTime() - days * 86400_000)),
      endDate: ymd(now),
      dimensions: "day",
      sort: "day",
      metrics: "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments",
    },
    token,
  );
  return rows.map((r) => ({
    day: String(r.day),
    views: Number(r.views ?? 0),
    watchMinutes: Number(r.estimatedMinutesWatched ?? 0),
    avgViewDurationSec: Number(r.averageViewDuration ?? 0),
    subsGained: Number(r.subscribersGained ?? 0),
    subsLost: Number(r.subscribersLost ?? 0),
    likes: Number(r.likes ?? 0),
    comments: Number(r.comments ?? 0),
  }));
}

/** Lifetime watch stats for specific videos. */
export async function getVideoAnalytics(token: string, videoIds: string[], now = new Date()): Promise<VideoAnalytics[]> {
  if (videoIds.length === 0) return [];
  const rows = await report(
    {
      startDate: "2005-02-14", // before YouTube existed, i.e. lifetime
      endDate: ymd(now),
      dimensions: "video",
      filters: `video==${videoIds.slice(0, 200).join(",")}`,
      metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage",
      sort: "-views",
      maxResults: "200",
    },
    token,
  );
  return rows.map((r) => ({
    videoId: String(r.video),
    views: Number(r.views ?? 0),
    watchMinutes: Number(r.estimatedMinutesWatched ?? 0),
    avgViewDurationSec: Number(r.averageViewDuration ?? 0),
    avgViewPercent: Number(r.averageViewPercentage ?? 0),
  }));
}

/**
 * Share of viewers still watching 30 seconds in (0-1), from the video's real
 * audience-retention curve. Null when YouTube has no curve for the video.
 */
export async function getRetentionAt30s(token: string, videoId: string, durationSec: number, now = new Date()) {
  if (durationSec <= 30) return null;
  const rows = await report(
    {
      startDate: "2005-02-14",
      endDate: ymd(now),
      dimensions: "elapsedVideoTimeRatio",
      filters: `video==${videoId}`,
      metrics: "audienceWatchRatio",
    },
    token,
  );
  if (rows.length === 0) return null;
  const target = 30 / durationSec;
  let best = rows[0];
  for (const r of rows) {
    if (Math.abs(Number(r.elapsedVideoTimeRatio) - target) < Math.abs(Number(best.elapsedVideoTimeRatio) - target)) best = r;
  }
  return Number(best.audienceWatchRatio);
}
