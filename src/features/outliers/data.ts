import "server-only";

import type { Result } from "@/lib/result";
import type { Viewer } from "@/lib/viewer";
import { isShort, type ScanVideo } from "@/lib/youtube/types";
import { scanTopic } from "@/features/discovery/scan";
import { summarizeTitles, type TitleSummary } from "./patterns";
import { scoreOutlier, type OutlierMetrics } from "./score";

export interface OutlierFilters {
  q: string;
  type: "all" | "long" | "short";
  days: number;
  minSubs: number;
  minScore: number;
  language?: string;
  categoryId?: string;
}

export interface OutlierRow {
  video: ScanVideo;
  metrics: OutlierMetrics;
}

export interface OutlierResults {
  rows: OutlierRow[];
  /** Videos returned by YouTube before TubeLens's own filters. */
  scanned: number;
  patterns: TitleSummary;
  note?: string;
}

/** Pure filter + sort, exported for tests. */
export function filterOutliers(videos: ScanVideo[], f: Pick<OutlierFilters, "type" | "minSubs" | "minScore">, now = new Date()): OutlierRow[] {
  return videos
    .filter((v) => (f.type === "all" ? true : f.type === "short" ? isShort(v) : !isShort(v)))
    .filter((v) => f.minSubs <= 0 || (v.channel.subscribers !== null && v.channel.subscribers >= f.minSubs))
    .map((video) => ({ video, metrics: scoreOutlier(video, now) }))
    .filter((r) => r.metrics.outlierScore !== null && r.metrics.outlierScore >= f.minScore)
    .sort((a, b) => b.metrics.outlierScore! - a.metrics.outlierScore!);
}

export async function getOutliers(viewer: Viewer, f: OutlierFilters): Promise<Result<OutlierResults>> {
  const scan = await scanTopic(viewer, { q: f.q, order: "viewCount", days: f.days, language: f.language, categoryId: f.categoryId });
  if (!scan.ok) return scan;
  const rows = filterOutliers(scan.data.videos, f);
  return {
    ...scan,
    data: {
      rows,
      scanned: scan.data.videos.length,
      patterns: summarizeTitles(rows.slice(0, 20).map((r) => r.video.title)),
      note: scan.data.note,
    },
  };
}
