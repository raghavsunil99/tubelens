import "server-only";

// Scheduled sync. Runs without any user's Google token: it uses the server's
// API key and stores only public numbers (subscribers, views, video counts) for
// every tracked channel, so history keeps building between visits. Private
// analytics (watch time and so on) are stored when the creator opens the app.
import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { pruneCache } from "@/lib/cache";
import { wouldExceed } from "@/lib/quota";
import { listChannels, listUploads, YouTubeError, type YtAuth } from "@/lib/youtube/client";
import { saveSync } from "./store";

export interface SyncReport {
  channels: number;
  synced: number;
  skipped: string | null;
}

export async function syncAllChannels(auth: YtAuth): Promise<SyncReport> {
  const ids = (getDb().prepare("SELECT id FROM channels WHERE is_demo = 0").all() as { id: string }[]).map((r) => r.id);
  const report: SyncReport = { channels: ids.length, synced: 0, skipped: null };
  pruneCache();
  try {
    for (let i = 0; i < ids.length; i += 50) {
      const channels = await listChannels(ids.slice(i, i + 50), auth);
      for (const channel of channels) {
        if (wouldExceed(2)) {
          report.skipped = "YouTube quota is nearly used up; the rest will sync next run.";
          return report;
        }
        const uploads = channel.uploadsPlaylistId ? await listUploads(channel.uploadsPlaylistId, auth, 30) : [];
        saveSync(channel, uploads);
        report.synced++;
      }
    }
  } catch (err) {
    report.skipped = err instanceof YouTubeError ? err.message : "Unexpected error; see the audit log.";
    logEvent("error", "sync.failed", err);
  }
  logEvent("info", "sync.completed", report);
  return report;
}
