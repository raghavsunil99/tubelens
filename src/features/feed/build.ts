// Builds the daily feed from evidence. Pure: give it the data, get cards back.
// A card only exists when the data supports it; nothing is predicted or invented.
import { compact } from "@/lib/format";
import type { Confidence } from "@/lib/result";
import { daysBetween, median, terms, topCounts } from "@/lib/text";
import { isShort, type ScanVideo, type Video } from "@/lib/youtube/types";
import { MIN_MOMENTUM_SPAN_DAYS, type Momentum } from "@/features/channel/momentum";
import type { KeywordAnalysis } from "@/features/keywords/score";
import { scoreOutlier } from "@/features/outliers/score";

export type CardKind =
  | "best_video"
  | "losing_momentum"
  | "niche_topics"
  | "study_videos"
  | "keyword_opportunity"
  | "upload_timing"
  | "setup";

export interface FeedCard {
  /** Stable for a week, so a dismissed card stays dismissed until the data moves on. */
  key: string;
  kind: CardKind;
  label: string;
  title: string;
  why: string;
  evidence: { label: string; value: string }[];
  confidence: Confidence;
  confidenceNote: string;
  action: { label: string; href: string };
  /** The same advice phrased as one thing to do today. */
  today: string;
}

export interface FeedInput {
  uploads: Video[];
  momentum: Momentum[];
  /** Days of stored history for this channel. */
  historyDays: number;
  niche: string | null;
  /** Cached scan of the niche, or null if none has been run. */
  nicheScan: ScanVideo[] | null;
  keywords: KeywordAnalysis[];
  timezone: string;
  now: Date;
}

export interface Feed {
  today: FeedCard | null;
  cards: FeedCard[];
  /** Why some cards are missing, in the creator's terms. */
  notes: string[];
}

const coach = (prompt: string) => `/ai-coach?prompt=${encodeURIComponent(prompt)}`;
const week = (now: Date) => Math.floor(now.getTime() / (7 * 86400_000));
const short = (t: string, n = 60) => ([...t].length > n ? `${[...t].slice(0, n - 1).join("")}…` : t);

function bestVideo(i: FeedInput): FeedCard | null {
  let best: { v: Video; ratio: number; typical: number; peers: number } | null = null;
  for (const v of i.uploads) {
    const age = daysBetween(v.publishedAt, i.now);
    if (age < 2 || age > 45) continue;
    const peers = i.uploads.filter((o) => o.id !== v.id && isShort(o) === isShort(v));
    const typical = median(peers.map((o) => o.views));
    if (peers.length < 4 || !typical) continue;
    const ratio = v.views / typical;
    if (ratio >= 1.3 && (!best || ratio > best.ratio)) best = { v, ratio, typical, peers: peers.length };
  }
  if (!best) return null;
  const kind = isShort(best.v) ? "Short" : "video";
  const x = Math.round(best.ratio * 10) / 10;
  return {
    key: `best_video:${best.v.id}:${week(i.now)}`,
    kind: "best_video",
    label: "Your best recent video",
    title: `"${short(best.v.title)}" is doing ${x}× your usual`,
    why: "When a video beats your normal numbers, the topic or packaging worked. A follow-up while it's still being watched is the cheapest win available.",
    evidence: [
      { label: "Views", value: compact(best.v.views) },
      { label: `Your typical ${kind}`, value: `${compact(best.typical)} (median of ${best.peers})` },
      { label: "Published", value: `${Math.round(daysBetween(best.v.publishedAt, i.now))} days ago` },
    ],
    confidence: best.peers >= 10 && best.ratio >= 2 ? "high" : "medium",
    confidenceNote:
      best.peers >= 10
        ? `Compared with ${best.peers} of your other ${kind}s. Older videos have had longer to collect views, so the real gap may be larger.`
        : `Compared with only ${best.peers} other ${kind}s.`,
    action: { label: "Plan a follow-up", href: coach(`My video "${best.v.title}" is doing ${x}x my usual views. Suggest 3 follow-up videos.`) },
    today: `Plan a follow-up to "${short(best.v.title, 48)}" while it's still pulling views.`,
  };
}

function losingMomentum(i: FeedInput): FeedCard | null {
  const byId = new Map(i.uploads.map((v) => [v.id, v]));
  const slowing = i.momentum
    .map((m) => ({ m, v: byId.get(m.videoId) }))
    // New uploads always slow down after launch, so only look at settled videos.
    .filter((x): x is { m: Momentum; v: Video } => Boolean(x.v) && daysBetween(x.v!.publishedAt, i.now) >= 14)
    .filter((x) => x.m.priorPerDay >= 20 && x.m.ratio <= 0.6)
    .sort((a, b) => b.m.priorPerDay - b.m.recentPerDay - (a.m.priorPerDay - a.m.recentPerDay))
    .slice(0, 3);
  if (slowing.length === 0) return null;
  const top = slowing[0];
  return {
    key: `losing_momentum:${top.v.id}:${week(i.now)}`,
    kind: "losing_momentum",
    label: "Losing momentum",
    title: slowing.length === 1 ? `"${short(top.v.title)}" is slowing down` : `${slowing.length} videos are slowing down`,
    why: "These videos were earning steady daily views and have dropped. A fresh title or thumbnail, or a link from your next upload, can bring an older video back.",
    evidence: slowing.map((x) => ({
      label: short(x.v.title, 42),
      value: `${compact(Math.round(x.m.priorPerDay))}/day → ${compact(Math.round(x.m.recentPerDay))}/day`,
    })),
    confidence: top.m.spanDays >= 10 ? "medium" : "low",
    confidenceNote: `From ${top.m.spanDays} days of TubeLens snapshots. Short windows can catch a normal dip, such as a weekend.`,
    action: { label: "Review this video", href: `/optimize/${top.v.id}` },
    today: `Review the title and thumbnail of "${short(top.v.title, 48)}", which has slowed down.`,
  };
}

function nicheCards(i: FeedInput): FeedCard[] {
  if (!i.nicheScan || !i.niche) return [];
  const scored = i.nicheScan
    .map((v) => ({ v, m: scoreOutlier(v, i.now) }))
    .filter((x) => x.m.outlierScore !== null && x.m.outlierScore >= 3 && x.m.confidence !== "low")
    .sort((a, b) => b.m.outlierScore! - a.m.outlierScore!);
  if (scored.length < 3) return [];
  const href = `/outliers?q=${encodeURIComponent(i.niche)}`;
  const cards: FeedCard[] = [];

  // Leave out the niche's own words (and their plurals): "phone" is not news in a "budget phones" scan.
  const stem = (w: string) => (w.length > 3 ? w.replace(/s$/, "") : w);
  const nicheWords = new Set(terms(i.niche).map(stem));
  const topics = topCounts(scored.flatMap((x) => [...new Set(terms(x.v.title))].filter((t) => !nicheWords.has(stem(t)) && t.length > 3 && !/^\d+$/.test(t))), 3);
  if (topics.length > 0) {
    cards.push({
      key: `niche_topics:${topics.map((t) => t.item).join("+")}:${week(i.now)}`,
      kind: "niche_topics",
      label: "Topics gaining attention",
      title: `"${topics[0].item}" keeps showing up in breakout ${i.niche} videos`,
      why: "When the same word appears in several videos that beat their channel's normal numbers, viewers are responding to the topic, not just one creator.",
      evidence: topics.map((t) => ({ label: `"${t.item}"`, value: `in ${t.count} of ${scored.length} breakout videos` })),
      confidence: scored.length >= 8 ? "medium" : "low",
      confidenceNote: `From ${scored.length} breakout videos in a scan of "${i.niche}". Word counts are a hint, not proof of demand.`,
      action: { label: "See the videos", href },
      today: `Look at how breakout videos cover "${topics[0].item}" and note one angle you could take.`,
    });
  }

  cards.push({
    key: `study_videos:${scored[0].v.id}:${week(i.now)}`,
    kind: "study_videos",
    label: "Videos worth studying",
    title: `${Math.min(3, scored.length)} ${i.niche} videos far above their channel's normal`,
    why: "Outliers show what works right now. Study the title, the first 30 seconds and the thumbnail, then borrow the structure, not the content.",
    evidence: scored.slice(0, 3).map((x) => ({ label: short(x.v.title, 42), value: `${x.m.outlierScore}× usual · ${x.v.channelTitle}` })),
    confidence: "medium",
    confidenceNote: "Each score compares the video with its channel's lifetime average, which is a rough baseline.",
    action: { label: "Open Outliers", href },
    today: `Watch the first 30 seconds of "${short(scored[0].v.title, 48)}" and write down how it opens.`,
  });
  return cards;
}

function keywordCard(i: FeedInput): FeedCard | null {
  const rank = { High: 2, Medium: 1, Low: 0, "Insufficient data": -1 } as const;
  const best = [...i.keywords].sort((a, b) => rank[b.opportunity] - rank[a.opportunity])[0];
  if (!best || rank[best.opportunity] < 1) return null;
  return {
    key: `keyword_opportunity:${best.phrase}:${week(i.now)}`,
    kind: "keyword_opportunity",
    label: "Keyword with opportunity",
    title: `"${best.phrase}" looks like a ${best.opportunity.toLowerCase()} opportunity`,
    why: best.gap.found ? best.gap.detail : best.competition.detail,
    evidence: [
      { label: "Competition", value: best.competition.level },
      { label: "Creator activity", value: best.trend.direction },
      { label: "Gap", value: best.gap.found ? "Found" : "None found" },
    ],
    confidence: best.confidence,
    confidenceNote: best.confidenceNote,
    action: { label: "Open keyword", href: `/keywords?q=${encodeURIComponent(best.phrase)}` },
    today: `Draft a title for "${best.phrase}" and check it against the top results.`,
  };
}

function uploadTiming(i: FeedInput): FeedCard | null {
  if (i.uploads.length < 8) return null;
  const fmt = new Intl.DateTimeFormat("en", { weekday: "long", timeZone: i.timezone });
  const byDay = new Map<string, number[]>();
  for (const v of i.uploads) {
    const d = fmt.format(new Date(v.publishedAt));
    byDay.set(d, [...(byDay.get(d) ?? []), v.views]);
  }
  const overall = median(i.uploads.map((v) => v.views));
  if (!overall) return null;
  const ranked = [...byDay.entries()]
    .filter(([, views]) => views.length >= 2)
    .map(([day, views]) => ({ day, n: views.length, med: median(views)! }))
    .sort((a, b) => b.med - a.med);
  const best = ranked[0];
  if (!best || ranked.length < 2 || best.med < overall * 1.25) return null;
  return {
    key: `upload_timing:${best.day}:${week(i.now)}`,
    kind: "upload_timing",
    label: "Upload timing",
    title: `Your ${best.day} uploads have done best`,
    why: "This comes from your own upload history. It can't see when your audience is online, so treat it as a pattern to test, not a rule.",
    evidence: [
      { label: `${best.day} uploads`, value: `${compact(best.med)} median views (${best.n} videos)` },
      { label: "All recent uploads", value: `${compact(overall)} median views (${i.uploads.length} videos)` },
    ],
    confidence: "low",
    confidenceNote: `Only ${best.n} ${best.day} uploads in the sample, and the topic of each video matters more than the day.`,
    action: { label: "Ask the Coach", href: coach(`My ${best.day} uploads have a higher median than my other days. Is that a real pattern, and how should I test it?`) },
    today: `Schedule your next upload for ${best.day} and compare it with your last one.`,
  };
}

function setupCards(i: FeedInput, have: Set<CardKind>): FeedCard[] {
  const cards: FeedCard[] = [];
  const base = { kind: "setup" as const, label: "Set up", evidence: [], confidence: "high" as const, confidenceNote: "This is a setup step, not a prediction." };
  if (!i.niche) {
    cards.push({
      ...base,
      key: "setup:niche",
      title: "Tell TubeLens your niche",
      why: "Niche topics, outliers and keyword ideas all start from the niche you choose.",
      action: { label: "Choose a niche", href: "/onboarding?step=3" },
      today: "Choose your niche so TubeLens can look for breakout videos in it.",
    });
  } else if (!have.has("study_videos")) {
    cards.push({
      ...base,
      key: `setup:scan:${i.niche}`,
      title: `Find breakout videos in ${i.niche}`,
      why: "A scan looks at recent top videos in your niche and compares each with its channel's normal numbers. Results are saved for a day so you can come back for free.",
      action: { label: "Run the scan", href: `/outliers?q=${encodeURIComponent(i.niche)}` },
      today: `Run a scan of ${i.niche} and pick one breakout video to study.`,
    });
  }
  if (i.keywords.length === 0) {
    cards.push({
      ...base,
      key: "setup:keyword",
      title: "Check a keyword you're considering",
      why: "Before you film, see who ranks for the phrase and whether smaller channels are getting through.",
      action: { label: "Open Keywords", href: i.niche ? `/keywords?q=${encodeURIComponent(i.niche)}` : "/keywords" },
      today: "Check one keyword for your next video before you start filming.",
    });
  }
  return cards;
}

export function buildFeed(i: FeedInput): Feed {
  const cards = [bestVideo(i), losingMomentum(i), ...nicheCards(i), keywordCard(i), uploadTiming(i)].filter(
    (c): c is FeedCard => c !== null,
  );
  cards.push(...setupCards(i, new Set(cards.map((c) => c.kind))));

  const notes: string[] = [];
  if (i.uploads.length === 0) notes.push("This channel has no public uploads yet, so there is nothing to analyse.");
  else if (i.uploads.length < 8) notes.push(`Upload timing needs at least 8 uploads to compare. This channel has ${i.uploads.length} in the recent sample.`);
  if (i.historyDays < MIN_MOMENTUM_SPAN_DAYS + 1) {
    notes.push(
      `Momentum alerts compare daily snapshots and need about ${MIN_MOMENTUM_SPAN_DAYS + 1} days of history. TubeLens has ${i.historyDays} so far.`,
    );
  }

  return { today: cards[0] ?? null, cards, notes };
}
