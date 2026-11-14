"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./ui/icons";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/feed", label: "Feed", icon: "feed" },
  { href: "/ai-coach", label: "AI Coach", icon: "coach" },
  { href: "/optimize", label: "Optimize", icon: "optimize" },
  { href: "/outliers", label: "Outliers", icon: "outliers" },
  { href: "/keywords", label: "Keywords", icon: "keywords" },
  { href: "/competitors", label: "Competitors", icon: "competitors" },
  { href: "/research", label: "Channel research", icon: "research" },
  { href: "/saved", label: "Saved", icon: "saved" },
  { href: "/settings", label: "Privacy & settings", icon: "settings" },
];

/** Navigation rail. `footer` (account box and Demo switch) is rendered by the server layout. */
export function Sidebar({ footer }: { footer: ReactNode }) {
  const path = usePathname();
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-line bg-panel md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
      <Link href="/feed" className="flex items-center gap-2.5 px-5 py-4">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-white">
          <Icon name="play" className="h-3.5 w-3.5" />
        </span>
        <span className="text-base font-semibold tracking-tight">TubeLens</span>
      </Link>
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
        {NAV.map((item) => {
          const active = path === item.href || path.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? "bg-panel-2 font-medium text-text" : "text-muted hover:bg-panel-2 hover:text-text"
              }`}
            >
              <Icon name={item.icon} className={`h-4 w-4 ${active ? "text-accent-soft" : ""}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3 border-t border-line p-3 md:border-t-0 md:p-4">{footer}</div>
    </aside>
  );
}
