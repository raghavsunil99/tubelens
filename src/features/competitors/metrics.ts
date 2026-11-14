// Channel summaries computed from a channel's recent public uploads. Used for
// both the creator's own channel and each competitor, so comparisons are
// like-for-like.
import { median, terms, topCounts, daysBetween } from "@/lib/text";
import { isShort, type Video } from "@/lib/youtube/types";
import { summarizeTitles, type TitlePattern } from "@/features/outliers/patterns";

export interface ChannelSummary {
  sample: number;
  /** Uploads per week over the last 8 weeks; null if the sample doesn't cover them. */
  uploadsPerWeek: number | null;
  medianViews: number | null;
  shortsShare: number | null;
  topVideos: Video[];
  topics: string[];
  titlePatterns: TitlePattern[];
}

export function summarizeChannel(uploads: Video[], now = new Date()): ChannelSummary {
  const n = uploads.length;
  const recent = uploads.filter((v) => daysBetween(v.publishedAt, now) <= 56);
  const oldest = uploads.reduce((max, v) => Math.max(max, daysBetween(v.publishedAt, now)), 0);
  // Only trust the 8-week rate if the sample reaches back that far (or the channel is simply quiet).
  const covers = n > 0 && (oldest >= 56 || recent.length < n);
  return {
    sample: n,
    uploadsPerWeek: covers ? Math.round((recent.length / 8) * 10) / 10 : null,
    medianViews: median(uploads.map((v) => v.views)),
    shortsShare: n ? uploads.filter(isShort).length / n : null,
    topVideos: [...uploads].sort((a, b) => b.views - a.views).slice(0, 3),
    topics: topCounts(uploads.flatMap((v) => [...new Set(terms(v.title))]), 8).map((t) => t.item),
    titlePatterns: summarizeTitles(uploads.map((v) => v.title)).patterns.slice(0, 4),
  };
}

export interface ContentGap {
  topic: string;
  /** Competitor videos on the topic that beat that competitor's own median. */
  examples: { title: string; views: number; channelTitle: string }[];
}

/**
 * Topics competitors cover with above-median results that never appear in the
 * creator's own titles or tags.
 */
export function findContentGaps(own: Video[], competitors: { title: string; uploads: Video[] }[]): ContentGap[] {
  const ownTerms = new Set(own.flatMap((v) => [...terms(v.title), ...v.tags.flatMap((t) => terms(t))]));
  const byTopic = new Map<string, ContentGap["examples"]>();
  for (const c of competitors) {
    const med = median(c.uploads.map((v) => v.views)) ?? 0;
    for (const v of c.uploads) {
      if (v.views <= med) continue;
      for (const t of new Set(terms(v.title))) {
        if (ownTerms.has(t) || t.length < 4 || /^\d+$/.test(t)) continue;
        const list = byTopic.get(t) ?? [];
        list.push({ title: v.title, views: v.views, channelTitle: c.title });
        byTopic.set(t, list);
      }
    }
  }
  return [...byTopic.entries()]
    .filter(([, ex]) => ex.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || b[1][0].views - a[1][0].views)
    .slice(0, 6)
    .map(([topic, examples]) => ({ topic, examples: examples.sort((a, b) => b.views - a.views).slice(0, 2) }));
}

export interface WeeklyChange {
  days: number;
  subscribers: number | null;
  views: number | null;
  videos: number | null;
}

/** Change between the newest snapshot and the one closest to 7 days before it. Null until 7 days of history exist. */
export function weeklyChange(
  snapshots: { day: string; subscriber_count: number | null; view_count: number | null; video_count: number | null }[],
): WeeklyChange | null {
  const rows = snapshots.filter((s) => s.view_count !== null).sort((a, b) => a.day.localeCompare(b.day));
  if (rows.length < 2) return null;
  const last = rows[rows.length - 1];
  const target = new Date(new Date(last.day).getTime() - 7 * 86400_000).toISOString().slice(0, 10);
  const base = [...rows].reverse().find((r) => r.day <= target);
  if (!base) return null;
  const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);
  return {
    days: Math.round((new Date(last.day).getTime() - new Date(base.day).getTime()) / 86400_000),
    subscribers: diff(last.subscriber_count, base.subscriber_count),
    views: diff(last.view_count, base.view_count),
    videos: diff(last.video_count, base.video_count),
  };
}
