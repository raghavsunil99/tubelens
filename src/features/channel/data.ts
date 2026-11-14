import "server-only";

import { cache } from "react";
import { cached } from "@/lib/cache";
import { logEvent } from "@/lib/log";
import { fail, ok, type Result } from "@/lib/result";
import type { Viewer } from "@/lib/viewer";
import { getDailyAnalytics, getMyChannel, getVideoAnalytics, listUploads, YouTubeError } from "@/lib/youtube/client";
import type { Channel, Video, VideoAnalytics } from "@/lib/youtube/types";
import { DEMO_CHANNEL, DEMO_SNAPSHOT_DAYS, demoHistory, demoUploads, demoVideoAnalytics, demoVideoSnapshots } from "@/demo/fixtures";
import type { VideoSnapshot } from "./momentum";
import { readHistory, readVideoSnapshots, saveSync, snapshotDays, type HistoryDay } from "./store";

export interface Overview {
  channel: Channel;
  /** Most recent uploads, newest first. */
  uploads: Video[];
  history: HistoryDay[];
  /** False when YouTube Analytics wasn't available (new or tiny channels, or the scope wasn't granted). */
  hasAnalytics: boolean;
  videoAnalytics: VideoAnalytics[] | null;
  snapshots: VideoSnapshot[];
  /** Days TubeLens has been taking its own snapshots. */
  historyDays: number;
}

const OVERVIEW_TTL_SEC = 15 * 60;

export function problemFrom(err: unknown, event: string): Result<never> {
  if (err instanceof YouTubeError) {
    logEvent(err.kind === "error" ? "error" : "warn", `${event}.${err.kind}`, err.message);
    return fail(err.kind, err.message);
  }
  logEvent("error", `${event}.unexpected`, err);
  return fail("error", "Something went wrong while loading this. It has been logged; please try again.");
}

/** The creator's channel, recent uploads and history. Deduplicated per request. */
export const getOverview = cache(async (viewer: Viewer): Promise<Result<Overview>> => {
  if (viewer.mode === "demo") {
    const history = demoHistory().map((d) => ({
      day: d.day,
      subscribers: d.subscriberCount,
      totalViews: d.viewCount,
      videoCount: d.videoCount,
      views: d.views,
      watchMinutes: d.watchMinutes,
      avgViewDurationSec: d.avgViewDurationSec,
      subsNet: d.subsGained - d.subsLost,
    }));
    return ok("demo", {
      channel: DEMO_CHANNEL,
      uploads: demoUploads(),
      history,
      hasAnalytics: true,
      videoAnalytics: demoVideoAnalytics(),
      snapshots: demoVideoSnapshots(),
      historyDays: DEMO_SNAPSHOT_DAYS,
    });
  }

  const session = viewer.session;
  if (!session) {
    return fail(
      viewer.oauthReady ? "disconnected" : "not_configured",
      viewer.oauthReady
        ? "Connect your YouTube channel to see your own numbers here."
        : "YouTube sign-in isn't set up on this server yet. Add the Google OAuth values to .env.local.",
    );
  }
  if (!session.channel) return fail("no_channel", "This Google account doesn't have a YouTube channel.");

  const token = session.accessToken;
  try {
    const live = await cached(`overview:${session.channel.id}`, OVERVIEW_TTL_SEC, async () => {
      const channel = await getMyChannel(token);
      if (!channel) return null;
      const uploads = channel.uploadsPlaylistId ? await listUploads(channel.uploadsPlaylistId, { kind: "token", token }, 30) : [];
      // Analytics is optional: brand-new channels have none, and the scope can be declined.
      const analytics = await getDailyAnalytics(token).catch((err) => {
        logEvent("warn", "analytics.daily_unavailable", err);
        return null;
      });
      const videoAnalytics = await getVideoAnalytics(token, uploads.map((v) => v.id)).catch((err) => {
        logEvent("warn", "analytics.video_unavailable", err);
        return null;
      });
      saveSync(channel, uploads, { analytics: analytics ?? undefined });
      return { channel, uploads, hasAnalytics: Boolean(analytics?.length), videoAnalytics };
    });
    if (!live.value) return fail("no_channel", "This Google account doesn't have a YouTube channel.");
    const { channel } = live.value;
    return ok(
      "youtube",
      {
        ...live.value,
        history: readHistory(channel.id),
        snapshots: readVideoSnapshots(channel.id),
        historyDays: snapshotDays(channel.id),
      },
      { fetchedAt: live.fetchedAt, fromCache: live.fromCache },
    );
  } catch (err) {
    return problemFrom(err, "overview");
  }
});
