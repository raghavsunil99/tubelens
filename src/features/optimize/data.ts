import "server-only";

import { logEvent } from "@/lib/log";
import type { Result } from "@/lib/result";
import { terms } from "@/lib/text";
import type { Viewer } from "@/lib/viewer";
import { getRetentionAt30s } from "@/lib/youtube/client";
import type { Video, VideoAnalytics } from "@/lib/youtube/types";
import { getOverview } from "@/features/channel/data";
import { issueCount, reviewVideo, type VideoReview } from "./score";

export interface ReviewRow {
  video: Video;
  review: VideoReview;
  analytics: VideoAnalytics | null;
  issues: number;
}

function build(viewer: Viewer, video: Video, analytics: VideoAnalytics[] | null): ReviewRow {
  const a = analytics?.find((x) => x.videoId === video.id) ?? null;
  const review = reviewVideo(video, { nicheTerms: viewer.prefs.niche ? terms(viewer.prefs.niche) : [], analytics: a });
  return { video, review, analytics: a, issues: issueCount(review) };
}

export async function getReviews(viewer: Viewer): Promise<Result<{ rows: ReviewRow[]; hasAnalytics: boolean }>> {
  const overview = await getOverview(viewer);
  if (!overview.ok) return overview;
  const { uploads, videoAnalytics, hasAnalytics } = overview.data;
  return { ...overview, data: { rows: uploads.map((v) => build(viewer, v, videoAnalytics)), hasAnalytics } };
}

export interface ReviewDetail extends ReviewRow {
  /** Share of viewers still watching at 30 seconds (0-1), from YouTube's retention curve. Null if unavailable. */
  retentionAt30s: number | null;
}

export async function getReview(viewer: Viewer, videoId: string): Promise<Result<ReviewDetail | null>> {
  const overview = await getOverview(viewer);
  if (!overview.ok) return overview;
  const video = overview.data.uploads.find((v) => v.id === videoId);
  if (!video) return { ...overview, data: null };
  const row = build(viewer, video, overview.data.videoAnalytics);
  let retentionAt30s: number | null = null;
  if (viewer.mode === "live" && viewer.session) {
    retentionAt30s = await getRetentionAt30s(viewer.session.accessToken, video.id, video.durationSec).catch((err) => {
      logEvent("warn", "analytics.retention_unavailable", err);
      return null;
    });
  }
  return { ...overview, data: { ...row, retentionAt30s } };
}
