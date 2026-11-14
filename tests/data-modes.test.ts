import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureOAuth, freshDb, jar, mockFetch, rawChannel, rawVideo, signIn } from "./helpers";
import { GET as outliersApi } from "@/app/api/outliers/route";
import { GET as keywordsApi } from "@/app/api/keywords/route";
import { GET as quotaApi } from "@/app/api/quota/route";
import { POST as cronApi } from "@/app/api/cron/sync/route";
import { POST as coachApi } from "@/app/api/ai-coach/chat/route";
import { DEMO_CHANNEL_ID } from "@/demo/fixtures";
import { getOverview } from "@/features/channel/data";
import { readHistory, snapshotDays } from "@/features/channel/store";
import { addCompetitor, getCompetitors } from "@/features/competitors/data";
import { getFeed, listSaved, setCardState } from "@/features/feed/data";
import { getKeyword, listKeywords } from "@/features/keywords/data";
import { quotaStatus } from "@/lib/quota";
import { MODE_COOKIE } from "@/lib/mode";
import { getViewer } from "@/lib/viewer";

const liveRoutes = () => ({
  "youtube/v3/channels": () => ({ items: [rawChannel()] }),
  "youtube/v3/playlistItems": () => ({ items: [{ contentDetails: { videoId: "a" } }, { contentDetails: { videoId: "b" } }] }),
  "youtube/v3/videos": () => ({ items: [rawVideo("a", 9000, 3), rawVideo("b", 1200, 12)] }),
  "youtubeanalytics.googleapis.com": (url: URL) =>
    url.searchParams.get("dimensions") === "day"
      ? {
          columnHeaders: ["day", "views", "estimatedMinutesWatched", "averageViewDuration", "subscribersGained", "subscribersLost", "likes", "comments"].map((name) => ({ name })),
          rows: [[new Date(Date.now() - 86400_000).toISOString().slice(0, 10), 321, 900, 140, 12, 2, 30, 4]],
        }
      : { columnHeaders: [], rows: [] },
});

beforeEach(() => {
  configureOAuth();
  delete process.env.YOUTUBE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.CRON_SECRET;
  freshDb();
  jar.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("demo mode", () => {
  it("is the default for a visitor with no channel, and never calls YouTube", async () => {
    const calls = mockFetch({});
    const viewer = await getViewer();
    expect(viewer.mode).toBe("demo");
    const overview = await getOverview(viewer);
    expect(overview.ok && overview.source).toBe("demo");
    expect(overview.ok && overview.data.channel.id).toBe(DEMO_CHANNEL_ID);
    const feed = await getFeed(viewer);
    expect(feed.ok && feed.data.feed.cards.length).toBeGreaterThan(3);
    expect(calls).toHaveLength(0);
  });

  it("stays demo for a connected creator who switches Demo mode on", async () => {
    await signIn();
    jar.set(MODE_COOKIE, "demo");
    const calls = mockFetch({});
    const viewer = await getViewer();
    const overview = await getOverview(viewer);
    expect(overview.ok && overview.source).toBe("demo");
    expect(viewer.userId).not.toContain("UCreal");
    expect(calls).toHaveLength(0);
  });

  it("keeps saved cards and keywords separate from live ones", async () => {
    await signIn();
    jar.set(MODE_COOKIE, "demo");
    const demo = await getViewer();
    setCardState(demo, { key: "k1", kind: "best_video", title: "Demo card", why: "w", href: "/x" }, "saved");
    expect(listSaved(demo).map((s) => s.title)).toEqual(["Demo card"]);
    jar.set(MODE_COOKIE, "live");
    const live = await getViewer();
    expect(live.userId).toBe("ch:UCreal0000000000000000001");
    expect(listSaved(live)).toEqual([]);
    expect(listKeywords(live)).toEqual([]);
  });

  it("refuses to add real competitors", async () => {
    expect(await addCompetitor(await getViewer(), "@someone")).toMatch(/Demo mode/);
  });
});

describe("live mode", () => {
  it("says 'disconnected' rather than showing demo numbers when nobody is signed in", async () => {
    jar.set(MODE_COOKIE, "live");
    const viewer = await getViewer();
    expect(viewer.mode).toBe("live");
    for (const result of [await getOverview(viewer), await getFeed(viewer), await getCompetitors(viewer), await getKeyword(viewer, "phones")]) {
      expect(result.ok).toBe(false);
      expect(!result.ok && result.problem.kind).toBe("disconnected");
      expect(JSON.stringify(result)).not.toContain("demo");
    }
  });

  it("reads the creator's real channel, labels it youtube, and stores history", async () => {
    await signIn();
    const calls = mockFetch(liveRoutes());
    const viewer = await getViewer();
    expect(viewer.mode).toBe("live");
    const overview = await getOverview(viewer);
    if (!overview.ok) throw new Error(overview.problem.message);
    expect(overview.source).toBe("youtube");
    expect(overview.data.channel.subscribers).toBe(4200);
    expect(overview.data.uploads.map((v) => v.views)).toEqual([9000, 1200]);
    expect(overview.data.hasAnalytics).toBe(true);
    expect(snapshotDays("UCreal0000000000000000001")).toBe(1);
    expect(readHistory("UCreal0000000000000000001").some((d) => d.views === 321 && d.watchMinutes === 900)).toBe(true);
    // The user's token is sent as a bearer header, never in a URL.
    expect(calls.every((c) => !c.url.includes("ya29"))).toBe(true);
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer ya29.test-access-token");
    expect(quotaStatus().used).toBe(3);
  });

  it("serves a second visit from the saved copy without spending quota", async () => {
    await signIn();
    const calls = mockFetch(liveRoutes());
    await getOverview(await getViewer());
    const first = calls.length;
    const again = await getOverview(await getViewer());
    expect(again.ok && again.fromCache).toBe(true);
    expect(calls.length).toBe(first);
  });

  it("reports quota exhaustion as a problem, with no demo fallback", async () => {
    await signIn();
    mockFetch({ "youtube/v3/channels": { status: 403, body: { error: { message: "quota", errors: [{ reason: "quotaExceeded" }] } } } });
    const overview = await getOverview(await getViewer());
    expect(overview.ok).toBe(false);
    expect(!overview.ok && overview.problem.kind).toBe("quota");
    expect(quotaStatus().level).toBe("exhausted");
  });

  it("still works when YouTube Analytics is unavailable, and says so", async () => {
    await signIn();
    mockFetch({ ...liveRoutes(), "youtubeanalytics.googleapis.com": { status: 403, body: { error: { message: "Forbidden", errors: [{ reason: "forbidden" }] } } } });
    const overview = await getOverview(await getViewer());
    expect(overview.ok && overview.data.hasAnalytics).toBe(false);
    expect(overview.ok && overview.data.videoAnalytics).toBeNull();
  });
});

describe("API routes", () => {
  const get = (path: string) => new Request(`http://localhost:3000${path}`);

  it("GET /api/outliers returns scored demo rows, labelled demo", async () => {
    const res = await outliersApi(get("/api/outliers?q=budget+phones&minScore=5&type=long"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("demo");
    expect(body.data.rows.length).toBeGreaterThan(0);
    for (const r of body.data.rows) {
      expect(r.metrics.outlierScore).toBeGreaterThanOrEqual(5);
      expect(r.video.durationSec).toBeGreaterThan(60);
      expect(r.metrics.reasons.length).toBeGreaterThan(0);
    }
  });

  it("GET /api/outliers validates input and reports live-mode problems with a status", async () => {
    expect((await outliersApi(get("/api/outliers"))).status).toBe(400);
    jar.set(MODE_COOKIE, "live");
    const res = await outliersApi(get("/api/outliers?q=phones"));
    expect(res.status).toBe(401);
    expect((await res.json()).problem.kind).toBe("disconnected");
  });

  it("GET /api/keywords never includes a search volume", async () => {
    const res = await keywordsApi(get("/api/keywords?q=camera+test"));
    const body = await res.json();
    expect(body.source).toBe("demo");
    expect(["High", "Medium", "Low", "Insufficient data"]).toContain(body.data.analysis.opportunity);
    // No field carries a volume figure; the only mention is the plain-language disclaimer.
    const keys = JSON.stringify(body).match(/"\w+":/g) ?? [];
    expect(keys.filter((k) => /volume|monthly|searches/i.test(k))).toEqual([]);
    expect(body.data.analysis.confidenceNote).toMatch(/Search volume is not available/);
  });

  it("GET /api/quota marks the figure as an estimate", async () => {
    expect(await (await quotaApi()).json()).toMatchObject({ used: 0, level: "ok", estimated: true });
  });

  it("POST /api/cron/sync is closed without configuration and rejects a wrong secret", async () => {
    const post = (auth?: string) => new Request("http://localhost:3000/api/cron/sync", { method: "POST", headers: auth ? { authorization: auth } : {} });
    expect((await cronApi(post())).status).toBe(503);
    process.env.CRON_SECRET = "cron-secret";
    process.env.YOUTUBE_API_KEY = "AIzaTestKey";
    expect((await cronApi(post("Bearer wrong-secret"))).status).toBe(401);
    expect((await cronApi(post())).status).toBe(401);
    const calls = mockFetch({});
    const ok = await cronApi(post("Bearer cron-secret"));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ channels: 0, synced: 0 });
    expect(calls).toHaveLength(0);
  });

  it("POST /api/ai-coach/chat rejects empty input and answers from labelled evidence", async () => {
    const post = (body: unknown) => new Request("http://localhost:3000/api/ai-coach/chat", { method: "POST", body: JSON.stringify(body) });
    expect((await coachApi(post({ messages: [] }))).status).toBe(400);
    const res = await coachApi(post({ messages: [{ role: "user", content: "Why did my last video underperform?" }] }));
    expect(res.headers.get("X-Data-Source")).toBe("demo");
    expect(res.headers.get("X-Data-Sections")).toContain("UPLOADS");
    const text = await res.text();
    for (const heading of ["**Diagnosis**", "**Evidence**", "**Recommendation**", "**Next action**"]) expect(text).toContain(heading);
    expect(text).toContain("demo numbers");
    expect(text).toMatch(/\[LATEST VIDEO REVIEW\]/);
  });

  it("the coach says it has no data in live mode without a channel", async () => {
    jar.set(MODE_COOKIE, "live");
    const res = await coachApi(new Request("http://localhost:3000/api/ai-coach/chat", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "What should I upload next?" }] }) }));
    expect(res.headers.get("X-Data-Source")).toBe("none");
    expect(await res.text()).toContain("no channel data");
  });
});
