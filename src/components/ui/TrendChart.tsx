"use client";

import { useState } from "react";

export interface TrendPoint {
  day: string;
  value: number;
  /** Titles of videos uploaded that day, shown as an annotation. */
  uploads?: string[];
}

const W = 720;
const H = 200;
const PAD = { top: 16, right: 12, bottom: 24, left: 44 };

const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** Single-series daily line with a hover crosshair and upload-day markers. */
export function TrendChart({ points, unit }: { points: TrendPoint[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;

  const max = Math.max(...points.map((p) => p.value), 1);
  const top = niceCeil(max);
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / top) * (H - PAD.top - PAD.bottom);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const area = `${line}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const active = hover === null ? null : points[hover];
  const ticks = [0, top / 2, top];
  const labelEvery = Math.ceil(points.length / 6);

  return (
    <div>
      <div className="overflow-x-auto">
      <div className="relative min-w-[520px]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Daily ${unit} for the last ${points.length} days`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--faint)">
              {compact(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={p.day} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--faint)">
              {dayLabel(p.day)}
            </text>
          ) : null,
        )}
        <path d={area} fill="var(--accent)" opacity="0.1" />
        <path d={line} fill="none" stroke="var(--accent-soft)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) =>
          p.uploads?.length ? (
            <circle key={p.day} cx={x(i)} cy={y(p.value)} r="4" fill="var(--panel)" stroke="var(--accent-soft)" strokeWidth="2">
              <title>{`Uploaded: ${p.uploads.join(", ")}`}</title>
            </circle>
          ) : null,
        )}
        {active && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(active.value)} r="4" fill="var(--accent-soft)" stroke="var(--panel)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {active && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 max-w-56 rounded-lg border border-line bg-panel-3 px-3 py-2 text-xs shadow-lg"
          style={hover > points.length / 2 ? { right: `${100 - (x(hover) / W) * 100 + 2}%` } : { left: `${(x(hover) / W) * 100 + 2}%` }}
        >
          <div className="text-muted">{dayLabel(active.day)}</div>
          <div className="tabular font-semibold">
            {active.value.toLocaleString("en-IN")} {unit}
          </div>
          {active.uploads?.map((t) => (
            <div key={t} className="mt-1 line-clamp-2 text-muted">
              Uploaded: {t}
            </div>
          ))}
        </div>
      )}
      </div>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-faint">
        <span className="inline-block h-2 w-2 rounded-full border-2 border-accent-soft" /> A ring marks a day you uploaded.
      </p>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer hover:text-text">Show as a table</summary>
        <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-line">
          <table className="tabular w-full text-left">
            <thead className="sticky top-0 bg-panel-2 text-faint">
              <tr>
                <th className="px-3 py-1.5 font-medium">Day</th>
                <th className="px-3 py-1.5 text-right font-medium capitalize">{unit}</th>
                <th className="px-3 py-1.5 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.day} className="border-t border-line/60">
                  <td className="px-3 py-1.5">{dayLabel(p.day)}</td>
                  <td className="px-3 py-1.5 text-right">{p.value.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-1.5">{p.uploads?.join(", ") ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function niceCeil(n: number) {
  const pow = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= n) return m * pow;
  return 10 * pow;
}
