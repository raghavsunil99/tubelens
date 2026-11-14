// Loads the demo fixtures into the database, flagged is_demo = 1. Demo mode in
// the app reads fixtures directly and does not need this; the seed exists so
// contributors and tests have rows to query.
import { getDb } from "@/lib/db";
import { saveSync } from "@/features/channel/store";
import { DEMO_CHANNEL, demoCompetitors, demoHistory, demoUploads, demoVideoSnapshots } from "./fixtures";

export function seedDemo(now = new Date()) {
  const db = getDb();
  const history = demoHistory(now);
  saveSync(DEMO_CHANNEL, demoUploads(now), { analytics: history, isDemo: true, now });
  const totals = db.prepare("UPDATE channel_daily_snapshots SET subscriber_count = ?, view_count = ?, video_count = ? WHERE channel_id = ? AND day = ?");
  for (const d of history) totals.run(d.subscriberCount, d.viewCount, d.videoCount, DEMO_CHANNEL.id, d.day);
  const snap = db.prepare("INSERT OR REPLACE INTO video_snapshots (video_id, day, view_count) VALUES (?, ?, ?)");
  for (const s of demoVideoSnapshots(now)) snap.run(s.videoId, s.day, s.views);

  const competitors = demoCompetitors(now);
  const day = db.prepare("INSERT OR REPLACE INTO channel_daily_snapshots (channel_id, day, subscriber_count, view_count, video_count) VALUES (?, ?, ?, ?, ?)");
  for (const c of competitors) {
    saveSync(c.channel, c.uploads, { isDemo: true, now });
    for (const s of c.snapshots) day.run(c.channel.id, s.day, s.subscriber_count, s.view_count, s.video_count);
  }
  return { channels: 1 + competitors.length, historyDays: history.length };
}
