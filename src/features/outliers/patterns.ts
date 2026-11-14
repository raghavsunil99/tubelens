// Counts simple, checkable patterns across a set of titles. Thumbnails are not
// analysed: TubeLens can't see images, so it doesn't pretend to.
import { detectScript, latinShare } from "@/lib/text";

export interface TitlePattern {
  label: string;
  count: number;
  example: string;
}

export interface TitleSummary {
  sample: number;
  medianLength: number | null;
  patterns: TitlePattern[];
  /** Writing systems seen, most common first. */
  scripts: { script: string; count: number }[];
}

const TESTS: [string, RegExp][] = [
  ["Uses a number", /\d/],
  ["Asks a question", /\?/],
  ["How-to", /\bhow to\b|\bhow i\b|\btutorial\b|\bguide\b/i],
  ["Ranked or list", /\b(top|best|worst|ranked|ranking)\b|\b\d+\s+(ways|tips|tricks|things|reasons|mistakes)\b/i],
  ["Comparison", /\bvs\.?\b|\bversus\b/i],
  ["Mentions a price", /[₹$]|\brs\.?\s?\d|\bunder\s+\d/i],
  ["Names a year", /\b20[2-3]\d\b/],
  ["First person", /^(i|my|we)\b|\b(i|my)\b/i],
  ["Warning or mistake", /\b(don'?t|never|stop|mistake|mistakes|avoid|wrong|worst|truth)\b/i],
  ["Brackets", /[([][^)\]]+[)\]]/],
];

export function summarizeTitles(titles: string[]): TitleSummary {
  const lengths = titles.map((t) => [...t].length).sort((a, b) => a - b);
  const patterns: TitlePattern[] = [];
  for (const [label, re] of TESTS) {
    // English patterns only make sense on titles that are mostly Latin script.
    const hits = titles.filter((t) => latinShare(t) >= 0.5 && re.test(t));
    if (hits.length >= 2) patterns.push({ label, count: hits.length, example: hits[0] });
  }
  patterns.sort((a, b) => b.count - a.count);

  const scriptCounts = new Map<string, number>();
  for (const t of titles) scriptCounts.set(detectScript(t), (scriptCounts.get(detectScript(t)) ?? 0) + 1);

  return {
    sample: titles.length,
    medianLength: lengths.length ? lengths[Math.floor(lengths.length / 2)] : null,
    patterns,
    scripts: [...scriptCounts.entries()].map(([script, count]) => ({ script, count })).sort((a, b) => b.count - a.count),
  };
}
