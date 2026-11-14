export function compact(n: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function duration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

export function timeAgo(date: string | number) {
  const ms = typeof date === "number" ? date * 1000 : new Date(date).getTime();
  const diff = Date.now() - ms;
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [86400_000 * 30, "mo"],
    [86400_000, "d"],
    [3600_000, "h"],
    [60_000, "m"],
  ];
  for (const [size, label] of units) {
    if (abs >= size) {
      const v = Math.floor(abs / size);
      return diff >= 0 ? `${v}${label} ago` : `in ${v}${label}`;
    }
  }
  return "just now";
}

/** Colour for a 0-100 score. */
export function scoreColor(score: number | null) {
  if (score === null) return "text-muted";
  if (score >= 70) return "text-good";
  if (score >= 45) return "text-warn";
  return "text-bad";
}
