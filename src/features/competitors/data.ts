import "server-only";

import { cached, dropCache } from "@/lib/cache";
import { getDb } from "@/lib/db";
import { fail, ok, type Result } from "@/lib/result";
import { ensureUser, publicAuth, type Viewer } from "@/lib/viewer";
import { findChannel, listChannels, listUploads } from "@/lib/youtube/client";
import type { Channel, Video } from "@/lib/youtube/types";
import { DEMO_CHANNEL, demoCompetitors, demoUploads } from "@/demo/fixtures";
import { getOverview, problemFrom } from "@/features/channel/data";
import { readTotals, saveSync, snapshotDays } from "@/features/channel/store";
import { findContentGaps, summarizeChannel, weeklyChange, type ChannelSummary, type ContentGap, type WeeklyChange } from "./metrics";

export interface TrackedChannel {
  channel: Channel;
  summary: ChannelSummary;
  /** Null until TubeLens has snapshots at least 7 days apart. */
  change: WeeklyChange | null;
  historyDays: number;
}

export interface CompetitorView {
  /** The creator's own channel, when available, for the comparison. */
  own: TrackedChannel | null;
  competitors: TrackedChannel[];
  gaps: ContentGap[];
}

const COMPETITOR_TTL_SEC = 6 * 3600;
export const MAX_COMPETITORS = 8;

async function loadCompetitor(viewer: Viewer, channelId: string): Promise<{ channel: Channel; uploads: Video[] } | null> {
  const auth = publicAuth(viewer);
  if (!auth) return null;
  const hit = await cached(`competitor:${channelId}`, COMPETITOR_TTL_SEC, async () => {
    const [channel] = await listChannels([channelId], auth);
    if (!channel) return null;
    const uploads = channel.uploadsPlaylistId ? await listUploads(channel.uploadsPlaylistId, auth, 20) : [];
    saveSync(channel, uploads);
    return { channel, uploads };
  });
  return hit.value;
}

export async function getCompetitors(viewer: Viewer): Promise<Result<CompetitorView>> {
  if (viewer.mode === "demo") {
    const demo = demoCompetitors();
    const ownUploads = demoUploads();
    return ok("demo", {
      own: { channel: DEMO_CHANNEL, summary: summarizeChannel(ownUploads), change: null, historyDays: 0 },
      competitors: demo.map((c) => ({
        channel: c.channel,
        summary: summarizeChannel(c.uploads),
        change: weeklyChange(c.snapshots),
        historyDays: c.snapshots.length,
      })),
      gaps: findContentGaps(ownUploads, demo.map((c) => ({ title: c.channel.title, uploads: c.uploads }))),
    });
  }

  if (!publicAuth(viewer)) {
    return fail(
      viewer.oauthReady ? "disconnected" : "not_configured",
      viewer.oauthReady ? "Connect YouTube to track competitor channels." : "Tracking competitors needs YOUTUBE_API_KEY (or a connected channel) on this server.",
    );
  }

  const ids = (
    getDb().prepare("SELECT channel_id FROM competitors WHERE user_id = ? ORDER BY added_at").all(viewer.userId) as { channel_id: string }[]
  ).map((r) => r.channel_id);

  try {
    const loaded: { channel: Channel; uploads: Video[] }[] = [];
    for (const id of ids) {
      const c = await loadCompetitor(viewer, id);
      if (c) loaded.push(c);
    }
    const overview = viewer.session?.channel ? await getOverview(viewer) : null;
    const ownData = overview?.ok ? overview.data : null;
    const track = (channel: Channel, uploads: Video[]): TrackedChannel => ({
      channel,
      summary: summarizeChannel(uploads),
      change: weeklyChange(readTotals(channel.id)),
      historyDays: snapshotDays(channel.id),
    });
    return ok("youtube", {
      own: ownData ? track(ownData.channel, ownData.uploads) : null,
      competitors: loaded.map((c) => track(c.channel, c.uploads)),
      gaps: ownData ? findContentGaps(ownData.uploads, loaded.map((c) => ({ title: c.channel.title, uploads: c.uploads }))) : [],
    });
  } catch (err) {
    return problemFrom(err, "competitors");
  }
}

/** Adds a competitor from a pasted URL, @handle or channel id. Returns an error message, or null on success. */
export async function addCompetitor(viewer: Viewer, input: string): Promise<string | null> {
  if (viewer.mode === "demo") return "Demo mode uses a fixed set of example channels. Switch to live data to track real ones.";
  const auth = publicAuth(viewer);
  if (!auth) return "Connect YouTube first, so TubeLens can look the channel up.";
  const count = (getDb().prepare("SELECT COUNT(*) AS n FROM competitors WHERE user_id = ?").get(viewer.userId) as { n: number } | undefined)?.n ?? 0;
  if (count >= MAX_COMPETITORS) return `You can track up to ${MAX_COMPETITORS} channels. Remove one to add another.`;
  try {
    const channel = await findChannel(input, auth);
    if (!channel) return "Couldn't find that channel. Paste its YouTube URL, @handle or channel id.";
    if (channel.id === viewer.channelId) return "That's your own channel. It's already in the comparison.";
    const uploads = channel.uploadsPlaylistId ? await listUploads(channel.uploadsPlaylistId, auth, 20) : [];
    saveSync(channel, uploads);
    ensureUser(viewer.userId);
    getDb().prepare("INSERT OR IGNORE INTO competitors (user_id, channel_id) VALUES (?, ?)").run(viewer.userId, channel.id);
    return null;
  } catch (err) {
    const r = problemFrom(err, "competitors.add");
    return r.ok ? null : r.problem.message;
  }
}

export function removeCompetitor(viewer: Viewer, channelId: string) {
  getDb().prepare("DELETE FROM competitors WHERE user_id = ? AND channel_id = ?").run(viewer.userId, channelId);
  dropCache(`competitor:${channelId}`);
}
