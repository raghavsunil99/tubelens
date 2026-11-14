import type { ReactNode } from "react";
import { setMode } from "@/app/actions";
import type { Mode } from "@/lib/mode";

/** A button that switches between demo and live data. Works without client JavaScript. */
export function ModeSwitchButton({ to, children, className }: { to: Mode; children: ReactNode; className?: string }) {
  return (
    <form action={setMode}>
      <input type="hidden" name="mode" value={to} />
      <button
        className={
          className ??
          "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-panel-2 px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-panel-3"
        }
      >
        {children}
      </button>
    </form>
  );
}

/** The always-visible Demo switch in the sidebar. */
export function ModeSwitch({ mode }: { mode: Mode }) {
  const demo = mode === "demo";
  return (
    <form action={setMode} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-3 py-2">
      <input type="hidden" name="mode" value={demo ? "live" : "demo"} />
      <span className="min-w-0">
        <span className="block text-xs font-medium">Demo mode</span>
        <span className="block text-[11px] text-muted">{demo ? "Showing example data" : "Showing YouTube data"}</span>
      </span>
      <button
        role="switch"
        aria-checked={demo}
        aria-label="Demo mode"
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${demo ? "bg-warn" : "bg-panel-3"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${demo ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </form>
  );
}
