import { ModeSwitch, ModeSwitchButton } from "@/components/ModeSwitch";
import { Sidebar } from "@/components/Sidebar";
import { LinkButton } from "@/components/ui";
import { quotaStatus } from "@/lib/quota";
import { getViewer, type Viewer } from "@/lib/viewer";

// Everything here depends on cookies (mode, session), so it's per-request.
export const dynamic = "force-dynamic";

function AccountBox({ viewer }: { viewer: Viewer }) {
  const { session } = viewer;
  if (!session) {
    return viewer.oauthReady ? (
      <LinkButton href="/api/auth/google" variant="primary" className="w-full">
        Connect YouTube
      </LinkButton>
    ) : (
      <p className="hidden rounded-lg border border-dashed border-line p-3 text-xs leading-relaxed text-muted md:block">
        YouTube sign-in isn&apos;t configured on this server. See <a href="/settings" className="text-accent-soft underline">Privacy &amp; settings</a>.
      </p>
    );
  }
  const name = session.channel?.title ?? session.user.name ?? "Signed in";
  return (
    <div className="flex items-center gap-2.5">
      {session.channel?.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={session.channel.thumbnail} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <div className="grid h-8 w-8 place-items-center rounded-full bg-panel-3 text-sm">{name[0]}</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="text-[11px] text-muted">{session.channel ? "Connected · read-only" : "No YouTube channel"}</div>
      </div>
    </div>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const quota = viewer.mode === "live" ? quotaStatus() : null;
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar
        footer={
          <>
            <AccountBox viewer={viewer} />
            <ModeSwitch mode={viewer.mode} />
          </>
        }
      />
      <div className="min-w-0 flex-1">
        {viewer.mode === "demo" && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-warn/25 bg-warn/[0.07] px-4 py-2.5 text-sm md:px-8">
            <p className="text-warn">
              <strong className="font-semibold">Demo mode.</strong>{" "}
              <span className="text-text/80">Every number here is a made-up example, not a real channel.</span>
            </p>
            {viewer.session?.channel ? (
              <ModeSwitchButton to="live" className="text-sm font-medium text-text underline underline-offset-4 hover:text-accent-soft">
                Switch to {viewer.session.channel.title}
              </ModeSwitchButton>
            ) : viewer.oauthReady ? (
              <a href="/api/auth/google" className="font-medium text-text underline underline-offset-4 hover:text-accent-soft">
                Connect your channel
              </a>
            ) : null}
          </div>
        )}
        {quota && quota.level !== "ok" && (
          <div role="status" className="border-b border-line bg-panel-2 px-4 py-2.5 text-sm text-muted md:px-8">
            {quota.level === "exhausted"
              ? "YouTube's daily API limit has been reached. New searches are paused until midnight Pacific time; saved results still open."
              : `TubeLens has used about ${Math.round((quota.used / quota.limit) * 100)}% of today's YouTube API allowance (its own estimate). New searches may pause soon.`}
          </div>
        )}
        <main className="px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
