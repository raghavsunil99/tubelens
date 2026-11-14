// Momentum = how a video's daily views now compare with a little earlier,
// read from TubeLens's own stored snapshots. Needs several days of history.

export interface VideoSnapshot {
  videoId: string;
  day: string;
  views: number;
}

export interface Momentum {
  videoId: string;
  recentPerDay: number;
  priorPerDay: number;
  /** recent ÷ prior */
  ratio: number;
  spanDays: number;
}

export const MIN_MOMENTUM_SPAN_DAYS = 4;

const dayNum = (d: string) => Math.round(new Date(`${d}T00:00:00Z`).getTime() / 86400_000);

export function computeMomentum(snapshots: VideoSnapshot[]): Momentum[] {
  const byVideo = new Map<string, VideoSnapshot[]>();
  for (const s of snapshots) byVideo.set(s.videoId, [...(byVideo.get(s.videoId) ?? []), s]);
  const out: Momentum[] = [];
  for (const [videoId, rows] of byVideo) {
    rows.sort((a, b) => a.day.localeCompare(b.day));
    const first = rows[0];
    const last = rows[rows.length - 1];
    const span = dayNum(last.day) - dayNum(first.day);
    if (span < MIN_MOMENTUM_SPAN_DAYS) continue;
    const midDay = dayNum(first.day) + span / 2;
    const mid = rows.reduce((best, r) => (Math.abs(dayNum(r.day) - midDay) < Math.abs(dayNum(best.day) - midDay) ? r : best));
    const priorDays = dayNum(mid.day) - dayNum(first.day);
    const recentDays = dayNum(last.day) - dayNum(mid.day);
    if (priorDays < 2 || recentDays < 2) continue;
    const priorPerDay = (mid.views - first.views) / priorDays;
    const recentPerDay = (last.views - mid.views) / recentDays;
    if (priorPerDay <= 0) continue;
    out.push({ videoId, recentPerDay, priorPerDay, ratio: recentPerDay / priorPerDay, spanDays: span });
  }
  return out;
}
