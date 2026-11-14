// A small set of 16px stroke icons, so the app doesn't depend on an icon package.
const PATHS: Record<string, string> = {
  feed: "M3 4h10M3 8h10M3 12h6",
  coach: "M8 2l1.6 3.6L13 7l-3.4 1.4L8 12l-1.6-3.6L3 7l3.4-1.4z",
  optimize: "M3 12l3.5-4 2.5 2.5L13 5M10 5h3v3",
  outliers: "M9 2L4 9h3.5L7 14l5-7H8.5z",
  research: "M7 12A5 5 0 107 2a5 5 0 000 10zM11 11l3 3",
  keywords: "M6 2L5 14M11 2l-1 12M3 6h11M2 10h11",
  competitors: "M3 13V8M8 13V3M13 13V6",
  saved: "M4 2h8v12l-4-3-4 3z",
  settings: "M8 10a2 2 0 100-4 2 2 0 000 4zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4",
  check: "M3 8.5l3 3 7-7",
  cross: "M4 4l8 8M12 4l-8 8",
  dash: "M4 8h8",
  arrow: "M3 8h10M9 4l4 4-4 4",
  external: "M6 3H3v10h10v-3M9 3h4v4M13 3L7 9",
  info: "M8 14A6 6 0 108 2a6 6 0 000 12zM8 7v4M8 5v.5",
  play: "M5 3l8 5-8 5z",
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
