import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Confidence, DataSource } from "@/lib/result";
import { Icon, type IconName } from "./icons";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Card({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" | "li" }) {
  return <Tag className={`rounded-xl border border-line bg-panel ${className}`}>{children}</Tag>;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-sm font-semibold tracking-tight">{children}</h2>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

type Tone = "neutral" | "accent" | "good" | "warn" | "bad";
const TONES: Record<Tone, string> = {
  neutral: "border-line text-muted",
  accent: "border-accent/40 bg-accent/10 text-accent-soft",
  good: "border-good/30 bg-good/10 text-good",
  warn: "border-warn/30 bg-warn/10 text-warn",
  bad: "border-bad/30 bg-bad/10 text-bad",
};

export function Badge({ children, tone = "neutral", title }: { children: ReactNode; tone?: Tone; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Says where the numbers on this screen came from. Present on every data page. */
export function SourceBadge({ source, fetchedAt, fromCache }: { source: DataSource; fetchedAt?: string; fromCache?: boolean }) {
  if (source === "demo") {
    return (
      <Badge tone="warn" title="These numbers are made-up examples, not from any real channel.">
        <span className="h-1.5 w-1.5 rounded-full bg-warn" /> Demo data
      </Badge>
    );
  }
  const when = fetchedAt ? new Date(fetchedAt).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : null;
  return (
    <Badge tone="good" title={when ? `Fetched from YouTube ${when} IST${fromCache ? " (saved copy)" : ""}` : "Fetched from YouTube"}>
      <span className="h-1.5 w-1.5 rounded-full bg-good" /> YouTube data{when ? ` · ${when}` : ""}
    </Badge>
  );
}

const CONFIDENCE: Record<Confidence, { label: string; dots: number }> = {
  high: { label: "High confidence", dots: 3 },
  medium: { label: "Medium confidence", dots: 2 },
  low: { label: "Low confidence", dots: 1 },
};

export function ConfidenceBadge({ level, note }: { level: Confidence; note?: string }) {
  const c = CONFIDENCE[level];
  return (
    <span title={note} className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= c.dots ? "bg-accent-soft" : "bg-panel-3"}`} />
        ))}
      </span>
      {c.label}
    </span>
  );
}

export function BandBadge({ band }: { band: "Strong" | "Okay" | "Needs work" | null }) {
  if (band === null) return <Badge>Not assessed</Badge>;
  return <Badge tone={band === "Strong" ? "good" : band === "Okay" ? "warn" : "bad"}>{band}</Badge>;
}

const BUTTON = {
  primary: "bg-accent text-white hover:bg-accent/90",
  secondary: "border border-line bg-panel-2 text-text hover:bg-panel-3",
  ghost: "text-muted hover:bg-panel-2 hover:text-text",
  danger: "border border-bad/40 text-bad hover:bg-bad/10",
};
const buttonClass = (variant: keyof typeof BUTTON, size: "sm" | "md") =>
  `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-40 ${size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} ${BUTTON[variant]}`;

type ButtonLook = { variant?: keyof typeof BUTTON; size?: "sm" | "md"; icon?: IconName };

export function Button({ variant = "secondary", size = "md", icon, children, className = "", ...rest }: ButtonLook & ComponentProps<"button">) {
  return (
    <button className={`${buttonClass(variant, size)} ${className}`} {...rest}>
      {children}
      {icon && <Icon name={icon} />}
    </button>
  );
}

export function LinkButton({ variant = "secondary", size = "md", icon, children, className = "", href, external }: ButtonLook & { href: string; children: ReactNode; className?: string; external?: boolean }) {
  const cls = `${buttonClass(variant, size)} ${className}`;
  // Plain <a> for API routes and external sites, so the browser follows redirects.
  if (external || href.startsWith("/api/") || href.startsWith("http")) {
    return (
      <a href={href} className={cls} {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
        {children}
        {icon && <Icon name={icon} />}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
      {icon && <Icon name={icon} />}
    </Link>
  );
}

export function Stat({ label, value, sub, note }: { label: string; value: ReactNode; sub?: ReactNode; note?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular mt-1.5 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="tabular mt-1 text-xs text-muted">{sub}</div>}
      {note && <div className="mt-2 text-[11px] leading-snug text-faint">{note}</div>}
    </Card>
  );
}

/** Signed change with an arrow, so direction never depends on colour alone. */
export function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  const up = value >= 0;
  return (
    <span className={up ? "text-good" : "text-bad"}>
      {up ? "▲" : "▼"} {new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Math.abs(value))}
      {suffix}
    </span>
  );
}

export function CheckList({ checks }: { checks: { label: string; pass: boolean | null; detail: string }[] }) {
  return (
    <ul className="space-y-2.5">
      {checks.map((c) => (
        <li key={c.label} className="flex gap-2.5 text-sm">
          <span
            className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${c.pass === null ? "bg-panel-3 text-faint" : c.pass ? "bg-good/15 text-good" : "bg-bad/15 text-bad"}`}
            title={c.pass === null ? "Not assessed" : c.pass ? "Passed" : "Needs attention"}
          >
            <Icon name={c.pass === null ? "dash" : c.pass ? "check" : "cross"} className="h-2.5 w-2.5" />
          </span>
          <span className="min-w-0">
            <span className="font-medium">{c.label}</span>
            <span className="block text-xs leading-relaxed text-muted">{c.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export const inputClass =
  "min-w-0 rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
      {label}
      {children}
      {hint && <span className="font-normal text-faint">{hint}</span>}
    </label>
  );
}

export function Select({ name, value, options }: { name: string; value: string; options: [string, string][] }) {
  return (
    <select name={name} defaultValue={value} className={`${inputClass} pr-8 text-text`}>
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

/** Small "how this is worked out" disclosure, so every score can be checked. */
export function Explain({ summary = "How this is worked out", children }: { summary?: string; children: ReactNode }) {
  return (
    <details className="group text-xs text-muted">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 hover:text-text">
        <Icon name="info" className="h-3.5 w-3.5" />
        {summary}
      </summary>
      <div className="mt-2 space-y-1.5 leading-relaxed">{children}</div>
    </details>
  );
}
