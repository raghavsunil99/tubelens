// Small text helpers shared by the scoring modules. No dependencies.

const SCRIPTS: [string, RegExp][] = [
  ["Telugu", /[ఀ-౿]/],
  ["Hindi", /[ऀ-ॿ]/],
  ["Tamil", /[஀-௿]/],
  ["Kannada", /[ಀ-೿]/],
  ["Malayalam", /[ഀ-ൿ]/],
  ["Bengali", /[ঀ-৿]/],
  ["Gujarati", /[઀-૿]/],
  ["Punjabi", /[਀-੿]/],
  ["Arabic/Urdu", /[؀-ۿ]/],
];

/** Writing system of a piece of text. "Latin" covers English and romanised languages such as Tenglish. */
export function detectScript(text: string): string {
  for (const [name, re] of SCRIPTS) if (re.test(text)) return name;
  return "Latin";
}

/** Share of letters that are Latin (0-1). English-only checks are skipped below ~0.5. */
export function latinShare(text: string) {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return 1;
  return letters.filter((c) => /[A-Za-z]/.test(c)).length / letters.length;
}

const STOP = new Set(
  "a an and are as at be but by for from has have how i in is it its my of on or our so that the this to was we what when where which who why will with you your vs not no do does did if than then into out up about after before over under all any can just more most new get got".split(
    " ",
  ),
);

/** Lower-cased meaningful words (any script), without stopwords or 1-character tokens. */
export function terms(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{M}\p{N}₹$%]+/gu) ?? []).filter((w) => w.length > 1 && !STOP.has(w));
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Most frequent items that appear at least `min` times. */
export function topCounts(items: string[], limit: number, min = 2): { item: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, c]) => c >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([item, count]) => ({ item, count }));
}

export const daysBetween = (fromIso: string, now: Date) => Math.max(0, (now.getTime() - new Date(fromIso).getTime()) / 86400_000);

export const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;
