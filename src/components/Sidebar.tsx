"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/feed", label: "Feed", icon: "◉" },
  { href: "/ai-coach", label: "AI Coach", icon: "✦" },
  { href: "/optimize", label: "Optimize", icon: "↗" },
  { href: "/outliers", label: "Outliers", icon: "⚡" },
  { href: "/research", label: "Channel research", icon: "⌕" },
  { href: "/keywords", label: "Keywords", icon: "#" },
  { href: "/competitors", label: "Competitors", icon: "⚔" },
];

interface Account {
  name: string;
  thumbnail?: string;
  hasChannel: boolean;
}

function AccountBox({ account, oauthReady }: { account: Account | null; oauthReady: boolean }) {
  if (!account) {
    return oauthReady ? (
      // A plain link (not next/link) so the browser follows the redirect to Google.
      <a
        href="/api/auth/google"
        className="flex items-center justify-center gap-2 rounded-lg bg-[#ff0033] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        <span aria-hidden>▶</span> Connect YouTube
      </a>
    ) : (
      <p className="rounded-lg border border-dashed border-line p-3 text-xs text-muted">
        Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SESSION_SECRET to .env.local to enable YouTube sign-in.
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {account.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={account.thumbnail} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <div className="grid h-8 w-8 place-items-center rounded-full bg-panel-2 text-sm">{account.name[0]}</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{account.name}</div>
        {!account.hasChannel && <div className="text-[11px] text-warn">No YouTube channel</div>}
      </div>
      <form action="/api/auth/logout" method="post">
        <button className="text-xs text-muted hover:text-text" title="Sign out">
          Sign out
        </button>
      </form>
    </div>
  );
}

export function Sidebar({
  credits,
  account,
  oauthReady,
}: {
  credits: { remaining: number; total: number };
  account: Account | null;
  oauthReady: boolean;
}) {
  const path = usePathname();
  const pct = Math.round((credits.remaining / credits.total) * 100);
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-line bg-panel md:h-screen md:w-60 md:border-r md:border-b-0 md:sticky md:top-0">
      <div className="flex items-center gap-2 px-5 py-4">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent font-bold text-white">T</div>
        <span className="text-lg font-semibold">TubeLens</span>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
        {NAV.map((item) => {
          const active = path === item.href || path.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? "bg-panel-2 text-text" : "text-muted hover:bg-panel-2 hover:text-text"
              }`}
            >
              <span className="w-4 text-center" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 pb-3 md:hidden">
        <AccountBox account={account} oauthReady={oauthReady} />
      </div>
      <div className="mt-auto hidden space-y-3 p-4 md:block">
        <AccountBox account={account} oauthReady={oauthReady} />
        <div className="rounded-xl border border-line bg-panel-2 p-3 text-xs">
          <div className="mb-2 flex justify-between text-muted">
            <span>AI credits</span>
            <span className="text-text">
              {credits.remaining}/{credits.total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-line">
            <div className="h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </aside>
  );
}
