// Keyword analysis from the top YouTube search results for a phrase.
//
// YouTube does not publish search volume, so TubeLens never shows one. What it
// can see is who ranks, how big they are and how fresh the results are, and
// each label below says exactly which of those it was read from.
import { compact } from "@/lib/format";
import type { Confidence } from "@/lib/result";
import { daysBetween, median, terms, topCounts } from "@/lib/text";
import { isShort, type ScanVideo } from "@/lib/youtube/types";

export type Level = "Low" | "Medium" | "High";
export type Opportunity = "High" | "Medium" | "Low" | "Insufficient data";

export interface KeywordAnalysis {
  phrase: string;
  sample: number;
  intent: { label: string; basis: string };
  competition: { level: Level | "Unknown"; detail: string };
  trend: { direction: "Rising" | "Steady" | "Quiet" | "Unknown"; detail: string };
  gap: { found: boolean; detail: string };
  opportunity: Opportunity;
  opportunityWhy: string;
  related: string[];
  suggestion: { title: string; hook: string; format: string };
  confidence: Confidence;
  confidenceNote: string;
}

export const MIN_SAMPLE = 8;

const INTENTS: [RegExp, string, string][] = [
  [/\bhow to\b|\btutorial\b|\bguide\b|\blearn\b|\bexplained?\b|\bcourse\b|\bfor beginners\b/i, "Learn how", "contains a how-to or learning word"],
  [/\bbest\b|\bvs\b|\bversus\b|\breview\b|\bunder\b|\bcheap\b|\bbudget\b|\btop\b|\bworth\b|\bprice\b/i, "Compare before buying", "contains a comparison or buying word"],
  [/\bnews\b|\bupdate\b|\bleaks?\b|\blaunch\b|\brelease\b|\btrailer\b|\b20[2-3]\d\b/i, "Stay up to date", "contains a news or date word"],
  [/\bideas?\b|\binspiration\b|\bexamples?\b|\btips\b/i, "Find ideas", "contains an ideas or tips word"],
];

export function searchIntent(phrase: string) {
  for (const [re, label, basis] of INTENTS) if (re.test(phrase)) return { label, basis: `Rule-based: the phrase ${basis}.` };
  return { label: "Explore or be entertained", basis: "Rule-based: no how-to, buying or news words in the phrase." };
}

function titleCase(s: string) {
  return s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

export function analyzeKeyword(phrase: string, videos: ScanVideo[], now = new Date()): KeywordAnalysis {
  const clean = phrase.trim().replace(/\s+/g, " ");
  const intent = searchIntent(clean);
  const n = videos.length;
  const phraseTerms = terms(clean);

  // Related phrases: tags and title word-pairs that recur across results.
  const candidates: string[] = [];
  for (const v of videos) {
    const seen = new Set<string>();
    for (const tag of v.tags) seen.add(tag.toLowerCase().trim());
    const words = terms(v.title);
    // Word pairs, skipping bare numbers and prices ("12 000" is not a phrase).
    const numeric = (w: string) => /^[₹$]?\d+%?$/.test(w);
    for (let i = 0; i < words.length - 1; i++) {
      if (!numeric(words[i]) && !numeric(words[i + 1])) seen.add(`${words[i]} ${words[i + 1]}`);
    }
    for (const s of seen) if (s.length > 3 && s.length < 40 && s !== clean.toLowerCase()) candidates.push(s);
  }
  const related = topCounts(candidates, 8).map((c) => c.item);

  const shorts = videos.filter(isShort).length;
  const longMinutes = median(videos.filter((v) => !isShort(v)).map((v) => v.durationSec / 60));
  const format =
    n === 0
      ? "Not enough results to suggest a format."
      : shorts / n >= 0.5
        ? `Short, under 60 seconds (${shorts} of the top ${n} results are Shorts).`
        : `Long-form, around ${Math.max(1, Math.round(longMinutes ?? 8))} minutes (the median of the long-form results).`;

  const suggestion = {
    title: suggestTitle(clean, intent.label, now),
    hook: suggestHook(clean, intent.label),
    format,
  };

  if (n < MIN_SAMPLE) {
    return {
      phrase: clean,
      sample: n,
      intent,
      competition: { level: "Unknown", detail: `Only ${n} results came back, which is too few to judge.` },
      trend: { direction: "Unknown", detail: "Too few results to judge freshness." },
      gap: { found: false, detail: "Too few results to look for a gap." },
      opportunity: "Insufficient data",
      opportunityWhy: `TubeLens needs at least ${MIN_SAMPLE} results to rate a keyword and found ${n}.`,
      related,
      suggestion,
      confidence: "low",
      confidenceNote: "Not enough search results to analyse.",
    };
  }

  // Competition: how big are the channels that rank, and how many titles target the phrase head-on?
  const subs = videos.map((v) => v.channel.subscribers).filter((s): s is number => s !== null);
  const medianSubs = median(subs);
  const exact = videos.filter((v) => {
    const t = new Set(terms(v.title));
    return phraseTerms.length > 0 && phraseTerms.every((p) => t.has(p));
  }).length;
  const exactShare = exact / n;
  let level: Level | "Unknown" = "Unknown";
  if (medianSubs !== null) {
    if (medianSubs >= 500_000 || (medianSubs >= 50_000 && exactShare >= 0.6)) level = "High";
    else if (medianSubs < 50_000 && exactShare < 0.6) level = "Low";
    else level = "Medium";
  }
  const competition = {
    level,
    detail:
      medianSubs === null
        ? "The ranking channels hide their subscriber counts."
        : `The typical ranking channel has ${compact(medianSubs)} subscribers, and ${exact} of ${n} top titles use every word of the phrase.`,
  };

  // Trend: how fresh are the results? This reads creator activity, not search demand.
  const recent = videos.filter((v) => daysBetween(v.publishedAt, now) <= 30).length;
  const recentShare = recent / n;
  const direction = recentShare >= 0.35 ? "Rising" : recentShare <= 0.1 ? "Quiet" : "Steady";
  const trend = {
    direction: direction as KeywordAnalysis["trend"]["direction"],
    detail: `${recent} of the top ${n} results were published in the last 30 days. This shows how actively creators are covering it, not how many people search for it.`,
  };

  // Content gap: small channels winning, or results going stale.
  const smallWinners = videos.filter(
    (v) => v.channel.subscribers !== null && v.channel.subscribers < 20_000 && v.views >= 10_000 && v.views >= 5 * v.channel.subscribers,
  );
  const medianAge = median(videos.map((v) => daysBetween(v.publishedAt, now))) ?? 0;
  let gap = { found: false, detail: "No clear gap: results are recent and held by established channels." };
  if (smallWinners.length >= 2) {
    gap = {
      found: true,
      detail: `${smallWinners.length} channels under 20K subscribers rank here with far more views than subscribers, so size is not deciding who wins.`,
    };
  } else if (medianAge > 365) {
    gap = { found: true, detail: `The typical top result is ${Math.round(medianAge / 30)} months old. A current, well-made video could stand out.` };
  }

  const points = (level === "Low" ? 2 : level === "Medium" ? 1 : 0) + (direction === "Rising" ? 1 : 0) + (gap.found ? 1 : 0);
  const opportunity: Opportunity = points >= 3 ? "High" : points === 2 ? "Medium" : "Low";
  const why: string[] = [];
  why.push(level === "Unknown" ? "competition could not be measured" : `${level.toLowerCase()} competition`);
  why.push(direction === "Rising" ? "creators are actively covering it" : direction === "Quiet" ? "few recent videos" : "steady coverage");
  why.push(gap.found ? "a gap was found" : "no gap found");

  return {
    phrase: clean,
    sample: n,
    intent,
    competition,
    trend,
    gap,
    opportunity,
    opportunityWhy: `Relative opportunity, from ${why.join(", ")}.`,
    related,
    suggestion,
    confidence: n >= 20 && level !== "Unknown" ? "medium" : "low",
    confidenceNote:
      n >= 20
        ? `Based on the top ${n} YouTube results. Search volume is not available from YouTube, so this is a relative read, not a forecast.`
        : `Based on only ${n} results, so treat this as a rough read.`,
  };
}

function suggestTitle(phrase: string, intent: string, now: Date) {
  const p = titleCase(phrase);
  const year = now.getFullYear();
  switch (intent) {
    case "Learn how":
      return `${p}: A Step-by-Step Walkthrough (${year})`;
    case "Compare before buying":
      return `${p}: I Tested Them So You Don't Have To`;
    case "Stay up to date":
      return `${p}: What Actually Changed`;
    case "Find ideas":
      return `${p} You Can Try This Week`;
    default:
      return `${p}: What Nobody Tells You`;
  }
}

function suggestHook(phrase: string, intent: string) {
  switch (intent) {
    case "Learn how":
      return `"By the end of this video you'll be able to do ${phrase} yourself. Here's the finished result first."`;
    case "Compare before buying":
      return `"I compared the options for ${phrase}. Here's the one I'd actually pick, and the one I'd skip."`;
    case "Stay up to date":
      return `"Here's what changed with ${phrase} and the one thing it means for you."`;
    case "Find ideas":
      return `"Here are the ${phrase} I'd start with today, beginning with the easiest."`;
    default:
      return `"Most videos on ${phrase} skip this part. I'll show it in the first minute."`;
  }
}
