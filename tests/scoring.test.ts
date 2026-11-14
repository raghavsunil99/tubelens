import { describe, expect, it } from "vitest";
import { demoCompetitors, demoScan, demoUploads, demoVideoSnapshots } from "@/demo/fixtures";
import { computeMomentum } from "@/features/channel/momentum";
import { findContentGaps, summarizeChannel, weeklyChange } from "@/features/competitors/metrics";
import { buildFeed } from "@/features/feed/build";
import { analyzeKeyword, MIN_SAMPLE, searchIntent } from "@/features/keywords/score";
import { band, reviewVideo, rewriteTitle } from "@/features/optimize/score";
import { filterOutliers } from "@/features/outliers/data";
import { summarizeTitles } from "@/features/outliers/patterns";
import { scoreOutlier } from "@/features/outliers/score";
import { detectScript, median } from "@/lib/text";
import type { ScanVideo, Video } from "@/lib/youtube/types";

const NOW = new Date("2026-11-15T12:00:00Z");

function scanVideo(over: Partial<Omit<ScanVideo, "channel">> & { channel?: Partial<ScanVideo["channel"]> } = {}): ScanVideo {
  const { channel, ...rest } = over;
  return {
    id: "v1",
    channelId: "c1",
    channelTitle: "Chan",
    title: "A title",
    description: "",
    tags: [],
    publishedAt: "2026-11-05T12:00:00Z",
    durationSec: 600,
    thumbnail: null,
    categoryId: null,
    language: null,
    views: 100_000,
    likes: 5_000,
    comments: 500,
    ...rest,
    channel: { id: "c1", title: "Chan", subscribers: 10_000, totalViews: 1_090_000, videoCount: 100, country: null, ...channel },
  };
}

describe("outlier score", () => {
  it("divides views by the channel average, leaving the video itself out", () => {
    const m = scoreOutlier(scanVideo(), NOW);
    // (1,090,000 - 100,000) / 99 other videos = 10,000 baseline
    expect(m.baselineViews).toBe(10_000);
    expect(m.outlierScore).toBe(10);
    expect(m.viewsPerSub).toBe(10);
    expect(m.ageDays).toBe(10);
    expect(m.viewsPerDay).toBe(10_000);
    expect(m.engagementRate).toBeCloseTo(0.055);
    expect(m.reasons.length).toBeGreaterThan(0);
    expect(m.confidence).toBe("medium");
  });

  it("returns null instead of guessing when data is missing", () => {
    const m = scoreOutlier(scanVideo({ likes: null, comments: null, channel: { subscribers: null, videoCount: 1, totalViews: 100_000 } }), NOW);
    expect(m.outlierScore).toBeNull();
    expect(m.viewsPerSub).toBeNull();
    expect(m.velocity).toBeNull();
    expect(m.engagementRate).toBeNull();
    expect(m.confidence).toBe("low");
  });

  it("marks tiny channels as low confidence", () => {
    expect(scoreOutlier(scanVideo({ channel: { videoCount: 5, totalViews: 140_000 } }), NOW).confidence).toBe("low");
  });

  it("filters by format, channel size and score, sorted by score", () => {
    const vids = [
      scanVideo({ id: "long" }),
      scanVideo({ id: "short", durationSec: 40, views: 200_000, channel: { totalViews: 1_190_000 } }),
      scanVideo({ id: "small", channel: { subscribers: 500 } }),
      scanVideo({ id: "hidden", channel: { subscribers: null } }),
    ];
    expect(filterOutliers(vids, { type: "short", minSubs: 0, minScore: 1 }, NOW).map((r) => r.video.id)).toEqual(["short"]);
    expect(filterOutliers(vids, { type: "all", minSubs: 1000, minScore: 1 }, NOW).map((r) => r.video.id)).toEqual(["short", "long"]);
    expect(filterOutliers(vids, { type: "all", minSubs: 0, minScore: 15 }, NOW).map((r) => r.video.id)).toEqual(["short"]);
  });
});

describe("title patterns", () => {
  it("counts patterns and scripts", () => {
    const s = summarizeTitles(["Top 5 Phones Under ₹15,000", "Is 5G Worth It?", "Best Phone 2026?", "రూ.15,000 లోపు బెస్ట్ ఫోన్ ఏది?"]);
    expect(s.sample).toBe(4);
    expect(s.patterns.find((p) => p.label === "Uses a number")?.count).toBe(3);
    expect(s.patterns.find((p) => p.label === "Asks a question")?.count).toBe(2);
    expect(s.scripts).toContainEqual({ script: "Telugu", count: 1 });
  });
  it("detects scripts", () => {
    expect(detectScript("నమస్కారం")).toBe("Telugu");
    expect(detectScript("नमस्ते")).toBe("Hindi");
    expect(detectScript("Namaskaram andi")).toBe("Latin");
  });
});

describe("keyword analysis", () => {
  it("refuses to rate a keyword with too few results", () => {
    const a = analyzeKeyword("budget phones", demoScan(NOW).slice(0, MIN_SAMPLE - 1), NOW);
    expect(a.opportunity).toBe("Insufficient data");
    expect(a.competition.level).toBe("Unknown");
    expect(a.confidence).toBe("low");
  });

  it("never reports a search volume", () => {
    const a = analyzeKeyword("budget phones", demoScan(NOW), NOW);
    expect(JSON.stringify(a)).not.toMatch(/monthly|searches per|volume":/i);
    expect(a.confidenceNote).toMatch(/not available|rough/i);
  });

  it("rates competition from who ranks", () => {
    const big = Array.from({ length: 10 }, (_, i) => scanVideo({ id: `b${i}`, title: "budget phones review", channel: { subscribers: 2_000_000 } }));
    const small = Array.from({ length: 10 }, (_, i) => scanVideo({ id: `s${i}`, title: "my phone story", channel: { subscribers: 3_000 } }));
    expect(analyzeKeyword("budget phones", big, NOW).competition.level).toBe("High");
    const a = analyzeKeyword("budget phones", small, NOW);
    expect(a.competition.level).toBe("Low");
    expect(a.gap.found).toBe(true); // small channels with views far above subscribers
    expect(a.opportunity).toBe("High");
  });

  it("classifies intent by rule", () => {
    expect(searchIntent("how to edit videos").label).toBe("Learn how");
    expect(searchIntent("best phone under 15000").label).toBe("Compare before buying");
    expect(searchIntent("minecraft").label).toBe("Explore or be entertained");
  });
});

describe("optimize review", () => {
  const uploads = demoUploads(NOW);
  const byTitle = (t: string) => uploads.find((v) => v.title.startsWith(t))!;

  it("grades a clear title as strong and a vague one as weak, with reasons", () => {
    const good = reviewVideo(byTitle("I Tested 9 Budget Phones"), { nicheTerms: ["budget", "phones"] });
    expect(good.titleClarity.band).toBe("Strong");
    const vague = reviewVideo(byTitle("my honest review"));
    expect(vague.topicRelevance.band).toBe("Needs work");
    expect(vague.description.checks.find((c) => c.label === "Opening repeats the topic")?.pass).toBe(false);
    expect(vague.suggestions.length).toBeGreaterThan(0);
  });

  it("flags shouting, clutter and length, and offers mechanical rewrites", () => {
    const loud = reviewVideo(byTitle("PHONE CAMERA SETTINGS"));
    const failed = loud.titleClarity.checks.filter((c) => c.pass === false).map((c) => c.label);
    expect(failed).toEqual(expect.arrayContaining(["Not shouting", "Clean punctuation"]));
    const rewrites = rewriteTitle("PHONE CAMERA SETTINGS NOBODY USES!!! #tech #phone #camera");
    expect(rewrites.at(-1)?.title).toBe("Phone Camera Settings Nobody Uses!");
    expect(rewriteTitle(byTitle("Unboxing the Tiniest Projector").title).every((r) => [...r.title].length <= 60)).toBe(true);
    expect(rewriteTitle("Is 5G Worth It Yet?")).toEqual([]);
  });

  it("does not run English-only checks on a Telugu title", () => {
    const te = reviewVideo(byTitle("రూ.15,000"));
    expect(te.hook.band).toBeNull();
    expect(te.titleClarity.checks.find((c) => c.label === "Not shouting")?.pass).toBeNull();
  });

  it("uses measured watch data when it exists and says hypothesis when it doesn't", () => {
    const v = byTitle("my honest review");
    expect(reviewVideo(v).retention.hypothesis).toMatch(/^Hypothesis \(not measured\)/);
    const measured = reviewVideo(v, { analytics: { videoId: v.id, views: 1, watchMinutes: 1, avgViewDurationSec: 165, avgViewPercent: 27 } });
    expect(measured.retention.measured?.avgViewPercent).toBe(27);
    expect(measured.retention.hypothesis).toMatch(/27%/);
  });

  it("needs at least two assessed checks to give a band", () => {
    expect(band([{ label: "a", pass: true, detail: "" }, { label: "b", pass: null, detail: "" }])).toBeNull();
  });
});

describe("momentum and feed", () => {
  it("finds the slowing video from snapshots", () => {
    const m = computeMomentum(demoVideoSnapshots(NOW));
    const slow = m.filter((x) => x.ratio <= 0.6);
    expect(slow).toHaveLength(1);
    expect(Math.round(slow[0].priorPerDay)).toBe(410);
    expect(Math.round(slow[0].recentPerDay)).toBe(140);
  });

  it("needs several days of history", () => {
    const two = demoVideoSnapshots(NOW).filter((s) => s.day >= "2026-11-14");
    expect(computeMomentum(two)).toEqual([]);
  });

  const input = {
    uploads: demoUploads(NOW),
    momentum: computeMomentum(demoVideoSnapshots(NOW)),
    historyDays: 14,
    niche: "budget phones",
    nicheScan: demoScan(NOW),
    keywords: [analyzeKeyword("budget phones", demoScan(NOW), NOW)],
    timezone: "Asia/Kolkata",
    now: NOW,
  };

  it("builds evidence-backed cards", () => {
    const feed = buildFeed(input);
    const kinds = feed.cards.map((c) => c.kind);
    expect(kinds).toEqual(expect.arrayContaining(["best_video", "losing_momentum", "niche_topics", "study_videos"]));
    expect(feed.today?.kind).toBe("best_video");
    for (const c of feed.cards) {
      expect(c.why.length).toBeGreaterThan(20);
      expect(c.action.href).toMatch(/^\//);
      expect(["high", "medium", "low"]).toContain(c.confidence);
      if (c.kind !== "setup") expect(c.evidence.length).toBeGreaterThan(0);
    }
    expect(JSON.stringify(feed)).not.toMatch(/predicted/i);
  });

  it("shows setup steps and honest notes when there is no data", () => {
    const feed = buildFeed({ ...input, uploads: [], momentum: [], historyDays: 1, niche: null, nicheScan: null, keywords: [] });
    expect(feed.cards.every((c) => c.kind === "setup")).toBe(true);
    expect(feed.notes.join(" ")).toMatch(/no public uploads/);
    expect(feed.notes.join(" ")).toMatch(/TubeLens has 1 so far/);
  });
});

describe("competitor metrics", () => {
  const comps = demoCompetitors(NOW);
  it("summarises a channel from its uploads", () => {
    const s = summarizeChannel(comps[0].uploads, NOW);
    expect(s.sample).toBe(12);
    expect(s.medianViews).toBe(median(comps[0].uploads.map((v) => v.views)));
    expect(s.topVideos[0].views).toBeGreaterThanOrEqual(s.topVideos[1].views);
  });
  it("only reports weekly change with 7 days of snapshots", () => {
    expect(weeklyChange(comps[0].snapshots)?.days).toBe(7);
    expect(weeklyChange(comps[0].snapshots.slice(-3))).toBeNull();
  });
  it("finds topics competitors cover that the creator doesn't", () => {
    const own: Video[] = [{ ...demoUploads(NOW)[7] }];
    const gaps = findContentGaps(own, comps.map((c) => ({ title: c.channel.title, uploads: c.uploads })));
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps[0].examples.length).toBeGreaterThan(0);
  });
});
