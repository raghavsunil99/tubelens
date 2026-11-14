// Reads and writes channel history in the database. No network calls here.
import { getDb, today } from "@/lib/db";
import type { AnalyticsDay, Channel, Video } from "@/lib/youtube/types";
import type { VideoSnapshot } from "./momentum";

export interface HistoryDay {
  day: string;
  subscribers: number | null;
  totalViews: number | null;
  videoCount: number | null;
  /** Per-day figures from YouTube Analytics; null for channels we only see publicly. */
  views: number | null;
  watchMinutes: number | null;
  avgViewDurationSec: number | null;
  subsNet: number | null;
}

/**
 * Stores one sync: the channel, its recent videos, today's totals and video
 * view counts, and (for the creator's own channel) per-day analytics.
 */
export function saveSync(
  channel: Channel,
  uploads: Video[],
  opts: { analytics?: AnalyticsDay[]; isDemo?: boolean; now?: Date } = {},
) {
  const db = getDb();
  const now = opts.now ?? new Date();
  const day = today(now);
  const demo = opts.isDemo ? 1 : 0;
  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO channels (id, title, handle, thumbnail_url, country, uploads_playlist_id, is_demo, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, handle = excluded.handle, thumbnail_url = excluded.thumbnail_url,
         country = excluded.country, uploads_playlist_id = excluded.uploads_playlist_id, last_synced_at = excluded.last_synced_at`,
    ).run(channel.id, channel.title, channel.handle, channel.thumbnail, channel.country, channel.uploadsPlaylistId, demo, now.toISOString());

    db.prepare(
      `INSERT INTO channel_daily_snapshots (channel_id, day, subscriber_count, view_count, video_count) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(channel_id, day) DO UPDATE SET subscriber_count = excluded.subscriber_count,
         view_count = excluded.view_count, video_count = excluded.video_count`,
    ).run(channel.id, day, channel.subscribers, channel.totalViews, channel.videoCount);

    const upVideo = db.prepare(
      `INSERT INTO videos (id, channel_id, title, description, tags, published_at, duration_sec, thumbnail_url, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, description = excluded.description, tags = excluded.tags,
         duration_sec = excluded.duration_sec, thumbnail_url = excluded.thumbnail_url`,
    );
    const upSnap = db.prepare(
      `INSERT INTO video_snapshots (video_id, day, view_count, like_count, comment_count) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(video_id, day) DO UPDATE SET view_count = excluded.view_count, like_count = excluded.like_count,
         comment_count = excluded.comment_count`,
    );
    for (const v of uploads) {
      upVideo.run(v.id, channel.id, v.title, v.description, JSON.stringify(v.tags), v.publishedAt, v.durationSec, v.thumbnail, demo);
      upSnap.run(v.id, day, v.views, v.likes, v.comments);
    }

    const upDay = db.prepare(
      `INSERT INTO channel_daily_snapshots (channel_id, day, views, watch_minutes, avg_view_duration_sec, subs_gained, subs_lost, likes, comments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(channel_id, day) DO UPDATE SET views = excluded.views, watch_minutes = excluded.watch_minutes,
         avg_view_duration_sec = excluded.avg_view_duration_sec, subs_gained = excluded.subs_gained,
         subs_lost = excluded.subs_lost, likes = excluded.likes, comments = excluded.comments`,
    );
    for (const a of opts.analytics ?? []) {
      upDay.run(channel.id, a.day, a.views, a.watchMinutes, a.avgViewDurationSec, a.subsGained, a.subsLost, a.likes, a.comments);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function readHistory(channelId: string, days = 30, now = new Date()): HistoryDay[] {
  const since = today(new Date(now.getTime() - days * 86400_000));
  const rows = getDb()
    .prepare(
      `SELECT day, subscriber_count, view_count, video_count, views, watch_minutes, avg_view_duration_sec, subs_gained, subs_lost
       FROM channel_daily_snapshots WHERE channel_id = ? AND day >= ? ORDER BY day`,
    )
    .all(channelId, since) as Record<string, number | string | null>[];
  return rows.map((r) => ({
    day: String(r.day),
    subscribers: r.subscriber_count as number | null,
    totalViews: r.view_count as number | null,
    videoCount: r.video_count as number | null,
    views: r.views as number | null,
    watchMinutes: r.watch_minutes as number | null,
    avgViewDurationSec: r.avg_view_duration_sec as number | null,
    subsNet: r.subs_gained === null ? null : (r.subs_gained as number) - ((r.subs_lost as number | null) ?? 0),
  }));
}

/** Raw snapshot rows for the weekly-change calculation. */
export function readTotals(channelId: string) {
  return getDb()
    .prepare("SELECT day, subscriber_count, view_count, video_count FROM channel_daily_snapshots WHERE channel_id = ? ORDER BY day")
    .all(channelId) as { day: string; subscriber_count: number | null; view_count: number | null; video_count: number | null }[];
}

/** Days on which TubeLens itself took a snapshot of the channel's totals. */
export function snapshotDays(channelId: string) {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM channel_daily_snapshots WHERE channel_id = ? AND view_count IS NOT NULL")
    .get(channelId) as { n: number };
  return row.n;
}

export function readVideoSnapshots(channelId: string, days = 21, now = new Date()): VideoSnapshot[] {
  const since = today(new Date(now.getTime() - days * 86400_000));
  return getDb()
    .prepare(
      `SELECT s.video_id AS videoId, s.day, s.view_count AS views FROM video_snapshots s
       JOIN videos v ON v.id = s.video_id WHERE v.channel_id = ? AND s.day >= ? ORDER BY s.day`,
    )
    .all(channelId, since) as unknown as VideoSnapshot[];
}

/** Removes everything stored for one creator: preferences, saves, chats and their channel's history. */
export function deleteUserData(userId: string, channelId: string | null) {
  const db = getDb();
  db.prepare("DELETE FROM users WHERE id = ?").run(userId); // cascades to keywords, competitors, ideas, alerts, chats
  if (channelId) {
    db.prepare("DELETE FROM channels WHERE id = ?").run(channelId); // cascades to videos and snapshots
    db.prepare("DELETE FROM api_cache WHERE key LIKE ?").run(`overview:${channelId}%`);
  }
}
