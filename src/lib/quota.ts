import { getDb } from "./db";

// YouTube Data API quota resets at midnight Pacific time. Google doesn't expose
// the remaining balance, so this is TubeLens's own running estimate of what it
// has spent, and the UI labels it that way.

export const UNIT_COST = { search: 100, list: 1 } as const;

export function dailyLimit() {
  const n = Number(process.env.YOUTUBE_DAILY_QUOTA);
  return Number.isFinite(n) && n > 0 ? n : 10_000;
}

export function quotaDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now);
}

export function recordUnits(units: number, now = new Date()) {
  getDb()
    .prepare(
      "INSERT INTO quota_usage (day, units) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET units = units + excluded.units",
    )
    .run(quotaDay(now), units);
}

export function markExhausted(now = new Date()) {
  getDb()
    .prepare(
      "INSERT INTO quota_usage (day, units, exhausted) VALUES (?, 0, 1) ON CONFLICT(day) DO UPDATE SET exhausted = 1",
    )
    .run(quotaDay(now));
}

export interface QuotaStatus {
  used: number;
  limit: number;
  /** ok: plenty left · low: over 80% used · exhausted: Google refused a call today */
  level: "ok" | "low" | "exhausted";
}

export function quotaStatus(now = new Date()): QuotaStatus {
  const row = getDb().prepare("SELECT units, exhausted FROM quota_usage WHERE day = ?").get(quotaDay(now)) as
    | { units: number; exhausted: number }
    | undefined;
  const used = row?.units ?? 0;
  const limit = dailyLimit();
  const level = row?.exhausted || used >= limit ? "exhausted" : used >= limit * 0.8 ? "low" : "ok";
  return { used, limit, level };
}

/** True when spending `units` more would likely be refused. */
export function wouldExceed(units: number, now = new Date()) {
  const s = quotaStatus(now);
  return s.level === "exhausted" || s.used + units > s.limit;
}
