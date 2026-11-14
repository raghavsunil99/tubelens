// Outlier scoring. Every number here is arithmetic on values YouTube returned;
// the only judgement call is the baseline, and it is named in the output.
import { compact } from "@/lib/format";
import type { Confidence } from "@/lib/result";
import { daysBetween, pct } from "@/lib/text";
import type { ScanVideo } from "@/lib/youtube/types";

export interface OutlierMetrics {
  /** The channel's lifetime average views per video, excluding this video. Null if it can't be computed. */
  baselineViews: number | null;
  /** views ÷ baseline */
  outlierScore: number | null;
  /** views ÷ subscribers; null when the channel hides its subscriber count */
  viewsPerSub: number | null;
  viewsPerDay: number;
  /** views per day for every 1,000 subscribers; null when subscribers are hidden */
  velocity: number | null;
  /** (likes + comments) ÷ views; null when both are hidden */
  engagementRate: number | null;
  ageDays: number;
  /** Plain-language reasons, strongest first. Empty when nothing stands out. */
  reasons: string[];
  confidence: Confidence;
  confidenceNote: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function scoreOutlier(v: ScanVideo, now = new Date()): OutlierMetrics {
  const { subscribers, totalViews, videoCount } = v.channel;
  const ageDays = Math.max(1, Math.round(daysBetween(v.publishedAt, now)));

  // Leave this video out of its own baseline so a breakout doesn't hide itself.
  const others = videoCount - 1;
  const baseline = others >= 1 && totalViews > v.views ? Math.round((totalViews - v.views) / others) : null;
  const outlierScore = baseline && baseline > 0 ? round1(v.views / baseline) : null;

  const viewsPerSub = subscribers && subscribers > 0 ? round1(v.views / subscribers) : null;
  const viewsPerDay = Math.round(v.views / ageDays);
  const velocity = subscribers && subscribers > 0 ? round1((viewsPerDay / subscribers) * 1000) : null;
  const interactions = (v.likes ?? 0) + (v.comments ?? 0);
  const engagementRate = v.views > 0 && (v.likes !== null || v.comments !== null) ? interactions / v.views : null;

  const reasons: string[] = [];
  if (outlierScore !== null && baseline !== null && outlierScore >= 2) {
    reasons.push(`${outlierScore}× this channel's usual views (${compact(v.views)} vs about ${compact(baseline)} per video).`);
  }
  if (viewsPerSub !== null && viewsPerSub >= 1.5) {
    reasons.push(
      `${viewsPerSub} views for every subscriber, so most viewers likely came from search or recommendations rather than the existing audience.`,
    );
  }
  if (subscribers !== null && subscribers < 20_000 && v.views >= 50_000) {
    reasons.push(`A small channel (${compact(subscribers)} subscribers) got here, which points to the topic and packaging rather than channel size.`);
  }
  if (ageDays <= 30 && velocity !== null && velocity >= 50) {
    reasons.push(`Still new (${ageDays} days) and averaging ${compact(viewsPerDay)} views a day.`);
  }
  if (engagementRate !== null && engagementRate >= 0.05) {
    reasons.push(`Likes and comments add up to ${pct(engagementRate, 1)} of views, which is a strong response.`);
  }

  let confidence: Confidence = "medium";
  let confidenceNote = "The baseline is the channel's lifetime average, which is a rough guide to how its recent videos do.";
  if (baseline === null) {
    confidence = "low";
    confidenceNote = "This channel has too little history to say what is normal for it.";
  } else if (videoCount < 10) {
    confidence = "low";
    confidenceNote = `The channel has only ${videoCount} videos, so its average is not a stable baseline.`;
  }

  return { baselineViews: baseline, outlierScore, viewsPerSub, viewsPerDay, velocity, engagementRate, ageDays, reasons, confidence, confidenceNote };
}
