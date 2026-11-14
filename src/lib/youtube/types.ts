// Normalised shapes for YouTube data. Counts that YouTube can hide are
// `number | null`: null means "not available", never zero.

export interface Channel {
  id: string;
  title: string;
  handle: string | null;
  thumbnail: string | null;
  country: string | null;
  uploadsPlaylistId: string | null;
  /** null when the channel hides its subscriber count */
  subscribers: number | null;
  totalViews: number;
  videoCount: number;
}

export interface Video {
  id: string;
  channelId: string;
  channelTitle: string;
  title: string;
  description: string;
  tags: string[];
  publishedAt: string;
  durationSec: number;
  thumbnail: string | null;
  categoryId: string | null;
  language: string | null;
  views: number;
  /** null when likes are hidden */
  likes: number | null;
  /** null when comments are turned off */
  comments: number | null;
}

/** A video plus the channel that published it, as returned by a topic scan. */
export interface ScanVideo extends Video {
  channel: Pick<Channel, "id" | "title" | "subscribers" | "totalViews" | "videoCount" | "country">;
}

/** One day of the creator's own YouTube Analytics. */
export interface AnalyticsDay {
  day: string;
  views: number;
  watchMinutes: number;
  avgViewDurationSec: number;
  subsGained: number;
  subsLost: number;
  likes: number;
  comments: number;
}

export interface VideoAnalytics {
  videoId: string;
  views: number;
  watchMinutes: number;
  avgViewDurationSec: number;
  /** average percentage of the video watched, 0-100 */
  avgViewPercent: number;
}

/**
 * YouTube's API doesn't say whether a video is a Short, and Shorts can run up
 * to 3 minutes. A video counts as a Short here if it is 60 seconds or less, or
 * up to 3 minutes and tagged #shorts by its creator.
 */
export const SHORT_MAX_SEC = 60;
export const SHORT_LIMIT_SEC = 180;

export function isShort(v: { durationSec: number; title?: string; description?: string; tags?: string[] }) {
  if (v.durationSec <= 0) return false;
  if (v.durationSec <= SHORT_MAX_SEC) return true;
  if (v.durationSec > SHORT_LIMIT_SEC) return false;
  return /#shorts?\b/i.test(`${v.title ?? ""} ${v.description ?? ""}`) || (v.tags ?? []).some((t) => /^shorts?$/i.test(t.trim()));
}

/** 61 to 180 seconds with no #shorts tag: could be either format. */
export const maybeShort = (v: { durationSec: number; title?: string; description?: string; tags?: string[] }) =>
  !isShort(v) && v.durationSec > SHORT_MAX_SEC && v.durationSec <= SHORT_LIMIT_SEC;
