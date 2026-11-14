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

/** Shorts can run up to 3 minutes, so duration is only a hint. 60s is the conservative cut. */
export const SHORT_MAX_SEC = 60;
export const isShort = (v: { durationSec: number }) => v.durationSec > 0 && v.durationSec <= SHORT_MAX_SEC;
