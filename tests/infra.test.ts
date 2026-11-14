import { beforeEach, describe, expect, it } from "vitest";
import { freshDb } from "./helpers";
import { cached, peekCache } from "@/lib/cache";
import { migrate } from "@/lib/db";
import { MODE_COOKIE, resolveMode } from "@/lib/mode";
import { markExhausted, quotaStatus, recordUnits, wouldExceed } from "@/lib/quota";
import { redact } from "@/lib/redact";
import { parseChannelInput, parseDuration, toYouTubeError } from "@/lib/youtube/client";
import { readHistory, readTotals, readVideoSnapshots } from "@/features/channel/store";
import { computeMomentum } from "@/features/channel/momentum";
import { weeklyChange } from "@/features/competitors/metrics";
import { DEMO_CHANNEL_ID } from "@/demo/fixtures";
import { seedDemo } from "@/demo/seed";

describe("database", () => {
  it("migrates once and creates every table in the data model", () => {
    const db = freshDb();
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name);
    for (const t of ["users", "channels", "videos", "channel_daily_snapshots", "video_snapshots", "keywords", "competitors", "saved_ideas", "alerts", "ai_conversations", "ai_messages", "api_cache", "quota_usage", "audit_log"]) {
      expect(tables).toContain(t);
    }
    expect(migrate(db)).toEqual([]);
  });

  it("has no column that could hold a Google token", () => {
    const db = freshDb();
    const cols = db.prepare("SELECT m.name AS t, p.name AS c FROM sqlite_master m, pragma_table_info(m.name) p WHERE m.type = 'table'").all() as { t: string; c: string }[];
    expect(cols.filter((x) => /token|secret|password|email/i.test(x.c))).toEqual([]);
  });

  it("seeds demo history that the history and momentum queries can read", () => {
    const db = freshDb();
    const report = seedDemo(new Date("2026-11-15T12:00:00Z"));
    expect(report.historyDays).toBe(30);
    const now = new Date("2026-11-15T12:00:00Z");
    expect(readHistory(DEMO_CHANNEL_ID, 30, now).length).toBe(30);
    expect(computeMomentum(readVideoSnapshots(DEMO_CHANNEL_ID, 21, now)).some((m) => m.ratio <= 0.6)).toBe(true);
    expect(weeklyChange(readTotals(DEMO_CHANNEL_ID))?.days).toBe(7);
    expect((db.prepare("SELECT COUNT(*) AS n FROM channels WHERE is_demo = 0").get() as { n: number }).n).toBe(0);
  });
});

describe("cache and quota", () => {
  beforeEach(() => void freshDb());

  it("loads once, then serves the saved copy", async () => {
    let loads = 0;
    const load = async () => ++loads;
    expect((await cached("k", 60, load)).fromCache).toBe(false);
    expect((await cached("k", 60, load)).fromCache).toBe(true);
    expect(loads).toBe(1);
    expect(peekCache("k", new Date(Date.now() + 61_000))).toBeNull();
  });

  it("tracks estimated usage and warns before the limit", () => {
    process.env.YOUTUBE_DAILY_QUOTA = "1000";
    expect(quotaStatus().level).toBe("ok");
    recordUnits(850);
    expect(quotaStatus()).toMatchObject({ used: 850, limit: 1000, level: "low" });
    expect(wouldExceed(100)).toBe(false);
    expect(wouldExceed(200)).toBe(true);
    markExhausted();
    expect(quotaStatus().level).toBe("exhausted");
    expect(wouldExceed(1)).toBe(true);
    delete process.env.YOUTUBE_DAILY_QUOTA;
  });
});

describe("YouTube error handling", () => {
  const body = (reason: string) => JSON.stringify({ error: { message: "m", errors: [{ reason }] } });
  it("recognises quota, rate limit, auth and not-found", () => {
    expect(toYouTubeError(403, body("quotaExceeded")).kind).toBe("quota");
    expect(toYouTubeError(403, body("rateLimitExceeded")).kind).toBe("rate_limited");
    expect(toYouTubeError(429, "").kind).toBe("rate_limited");
    expect(toYouTubeError(401, body("authError")).kind).toBe("auth");
    expect(toYouTubeError(403, body("forbidden")).kind).toBe("auth");
    expect(toYouTubeError(404, "not json").kind).toBe("not_found");
    expect(toYouTubeError(500, "").kind).toBe("error");
  });
  it("parses channel inputs and durations", () => {
    expect(parseChannelInput("https://www.youtube.com/@TeluguTech")).toEqual({ handle: "@TeluguTech" });
    expect(parseChannelInput("@phonelab")).toEqual({ handle: "@phonelab" });
    expect(parseChannelInput("https://youtube.com/channel/UCabcdefghijklmnopqrstuv/videos")).toEqual({ id: "UCabcdefghijklmnopqrstuv" });
    expect(parseChannelInput("not a channel!!")).toBeNull();
    expect(parseDuration("PT1H2M3S")).toBe(3723);
    expect(parseDuration("PT45S")).toBe(45);
  });
});

describe("log redaction", () => {
  it("removes tokens, keys and secrets", () => {
    const dirty = `access ya29.a0AfH6SMBx-secret refresh 1//0gABCDEFGHIJKLMNOP key=AIzaSyD-1234567890abcdefghij Authorization: Bearer abc.def.ghi {"client_secret":"shhh","refresh_token":"1//zzz"} ?code=4/0AbCd`;
    const clean = redact(dirty);
    for (const leak of ["a0AfH6SMBx", "0gABCDEFGHIJKLMNOP", "AIzaSyD", "abc.def.ghi", "shhh", "4/0AbCd"]) expect(clean).not.toContain(leak);
  });
  it("handles errors and objects", () => {
    expect(redact(new Error("failed with token=abc123"))).toBe("Error: failed with token=[redacted]");
    expect(redact({ a: 1 })).toBe('{"a":1}');
  });
});

describe("mode", () => {
  it("lets an explicit choice win, and otherwise goes live only with a channel", () => {
    expect(MODE_COOKIE).toBe("tl_mode");
    expect(resolveMode(undefined, false)).toBe("demo");
    expect(resolveMode(undefined, true)).toBe("live");
    expect(resolveMode("demo", true)).toBe("demo");
    expect(resolveMode("live", false)).toBe("live");
    expect(resolveMode("garbage", false)).toBe("demo");
  });
});
