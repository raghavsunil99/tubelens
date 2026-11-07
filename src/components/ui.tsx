import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-panel ${className}`}>{children}</div>;
}

export function SourceBadge({ source }: { source: "youtube" | "mock" }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs ${
        source === "youtube" ? "border-good/40 text-good" : "border-line text-muted"
      }`}
      title={source === "mock" ? "Set YOUTUBE_API_KEY in .env.local for live data" : "Live YouTube Data API"}
    >
      {source === "youtube" ? "Live YouTube data" : "Demo data"}
    </span>
  );
}

const NICHE_EMOJI: Record<string, string> = {
  Tech: "📱",
  "Personal Finance": "💰",
  Cooking: "🍛",
  Gaming: "🎮",
  Education: "🔭",
  Fitness: "💪",
};

/** Short, punchy thumbnail text from a video title: first 4 words, upper-case. */
function thumbText(title: string) {
  return title.replace(/[()]/g, "").split(/\s+/).slice(0, 4).join(" ").toUpperCase();
}

/**
 * Thumbnail. Without an image URL it draws thumbnail-style placeholder art
 * (gradient, emoji, bold headline) from the title and niche.
 */
export function Thumb({
  src,
  seed,
  label,
  title,
  niche,
}: {
  src?: string;
  seed: string;
  label?: string;
  title?: string;
  niche?: string;
}) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <div
      className="@container relative aspect-video w-full overflow-hidden rounded-lg"
      style={{ background: `linear-gradient(135deg, hsl(${h} 70% 45%), hsl(${(h + 50) % 360} 75% 22%))` }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : title ? (
        <div className="absolute inset-0 flex items-center gap-[4cqw] p-[6cqw]">
          <span className="text-[22cqw] leading-none drop-shadow-lg" aria-hidden>
            {NICHE_EMOJI[niche ?? ""] ?? "🎬"}
          </span>
          <span className="text-[8.5cqw] leading-[1.05] font-black tracking-tight text-white [text-shadow:0_2px_8px_rgb(0_0_0/0.45)]">
            {thumbText(title)}
          </span>
        </div>
      ) : null}
      {label && (
        <span className="absolute right-1.5 bottom-1.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[11px] text-white">
          {label}
        </span>
      )}
    </div>
  );
}

export function SearchForm({ name, placeholder, defaultValue, action }: { name: string; placeholder: string; defaultValue?: string; action: string }) {
  return (
    <form action={action} className="flex w-full max-w-md gap-2">
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
      />
      <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">Search</button>
    </form>
  );
}
