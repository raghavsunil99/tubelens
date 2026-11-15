import { deleteMyData } from "@/app/actions";
import { Badge, Button, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { geminiEnabled } from "@/features/coach/coach";
import { languageName } from "@/features/onboarding/options";
import { desktopMode } from "@/lib/desktop";
import { GOOGLE_SCOPES } from "@/lib/google-oauth";
import { recentEvents } from "@/lib/log";
import { quotaStatus } from "@/lib/quota";
import { getViewer } from "@/lib/viewer";

type SP = Promise<{ deleted?: string; disconnected?: string }>;

const SCOPE_EXPLAINED: Record<string, string> = {
  openid: "Confirms it's you signing in.",
  email: "Your email address, shown only to you. It is not stored in the database.",
  profile: "Your name, to greet you.",
  "https://www.googleapis.com/auth/youtube.readonly": "Read your channel details and video list. Cannot upload, edit, delete or comment.",
  "https://www.googleapis.com/auth/yt-analytics.readonly": "Read your views, watch time and subscriber changes. Cannot change anything.",
};

function Setup({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-muted">{detail}</div>
      </div>
      <Badge tone={ok ? "good" : "neutral"}>{ok ? "Ready" : "Not set"}</Badge>
    </li>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: SP }) {
  const { deleted, disconnected } = await searchParams;
  const viewer = await getViewer();
  const quota = quotaStatus();
  // The log covers the whole server, so it is only shown on a local/dev install.
  const showLog = process.env.NODE_ENV !== "production" || desktopMode();
  const events = showLog ? recentEvents(8) : [];
  const { session, prefs } = viewer;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Privacy & settings" subtitle="What TubeLens can see, what it stores, and how to remove it." />
      {deleted && <div role="status" className="mb-5 rounded-lg border border-good/30 bg-good/10 px-4 py-3 text-sm text-good">Your stored data has been deleted.</div>}
      {disconnected && <div role="status" className="mb-5 rounded-lg border border-good/30 bg-good/10 px-4 py-3 text-sm text-good">Disconnected. TubeLens&apos;s access to your Google account has been revoked.</div>}

      <section className="mb-8">
        <SectionTitle>YouTube connection</SectionTitle>
        <Card className="p-5">
          {session ? (
            <>
              <p className="text-sm">
                Connected as <strong>{session.channel?.title ?? session.user.name ?? "your Google account"}</strong>. <Badge tone="good">Read-only</Badge>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Disconnecting signs you out and tells Google to revoke TubeLens&apos;s access straight away. You can also remove it yourself at{" "}
                <a className="text-accent-soft underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.
              </p>
              <form action="/api/auth/logout" method="post" className="mt-4">
                <Button variant="danger">Disconnect and revoke access</Button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-muted">No channel is connected. {viewer.oauthReady ? "Connecting is read-only: TubeLens can never post, edit or delete anything." : "Google sign-in isn't configured on this server yet (see Server setup below)."}</p>
              {viewer.oauthReady && <div className="mt-4"><LinkButton href="/api/auth/google" variant="primary">Connect YouTube</LinkButton></div>}
            </>
          )}
        </Card>
      </section>

      <section className="mb-8">
        <SectionTitle hint="Requested when you connect">What TubeLens asks Google for</SectionTitle>
        <Card className="px-5">
          <ul className="divide-y divide-line/60">
            {GOOGLE_SCOPES.map((s) => (
              <li key={s} className="py-3">
                <code className="text-xs text-accent-soft">{s.replace("https://www.googleapis.com/auth/", "")}</code>
                <p className="mt-1 text-sm leading-relaxed text-muted">{SCOPE_EXPLAINED[s]}</p>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="mb-8">
        <SectionTitle>What is stored, and where</SectionTitle>
        <Card className="space-y-3 p-5 text-sm leading-relaxed text-muted">
          <p><strong className="text-text">Your Google tokens</strong> live only in an encrypted (AES-256-GCM), httpOnly cookie in your browser. They are never written to the database or to logs.</p>
          <p><strong className="text-text">In the database:</strong> your channel&apos;s public details, daily snapshots of its numbers, your recent videos&apos; stats, the niche, language and goal you chose, keywords and competitors you added, cards you saved, and your Coach conversations.</p>
          <p><strong className="text-text">AI Coach:</strong> when you ask a question, a summary of your channel&apos;s numbers and recent video titles is sent to Google Gemini to write the answer. Nothing is sent until you ask.</p>
          <p><strong className="text-text">Never:</strong> TubeLens does not sell or share data, and it cannot change anything on your channel.</p>
          <form action={deleteMyData} className="pt-2">
            <Button variant="danger">Delete everything stored about me</Button>
            <p className="mt-2 text-xs text-faint">Removes your preferences, saved items, keywords, competitors, chats and your channel&apos;s history from this server. This can&apos;t be undone.</p>
          </form>
        </Card>
      </section>

      <section className="mb-8">
        <SectionTitle>Your preferences</SectionTitle>
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-muted">Niche</dt><dd>{prefs.niche ?? "Not set"}</dd>
            <dt className="text-muted">Language</dt><dd>{languageName(prefs.language) ?? "Not set"}</dd>
            <dt className="text-muted">Goal</dt><dd>{prefs.goal ?? "Not set"}</dd>
          </dl>
          <LinkButton href="/onboarding?step=3" size="sm">Change</LinkButton>
        </Card>
      </section>

      <section className="mb-8">
        <SectionTitle hint="TubeLens's own estimate; Google doesn't report the balance">YouTube API usage today</SectionTitle>
        <Card className="p-5">
          <div className="tabular flex items-baseline justify-between text-sm">
            <span>{quota.used.toLocaleString("en-IN")} of {quota.limit.toLocaleString("en-IN")} units</span>
            <Badge tone={quota.level === "ok" ? "good" : quota.level === "low" ? "warn" : "bad"}>{quota.level === "ok" ? "Plenty left" : quota.level === "low" ? "Running low" : "Limit reached"}</Badge>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-panel-3" role="img" aria-label={`${Math.round((quota.used / quota.limit) * 100)}% used`}>
            <div className="h-1.5 rounded-full bg-accent-soft" style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-faint">A new search costs about 100 units; opening your own channel costs about 3. Results are saved so repeat visits are free. The allowance resets at midnight Pacific time.</p>
        </Card>
      </section>

      <section className="mb-8">
        <SectionTitle>Server setup</SectionTitle>
        <Card className="px-5">
          <ul className="divide-y divide-line/60">
            <Setup label="Google sign-in" ok={viewer.oauthReady} detail="GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SESSION_SECRET. Needed to connect a channel." />
            <Setup label="YouTube API key" ok={Boolean(process.env.YOUTUBE_API_KEY)} detail="YOUTUBE_API_KEY. Used for searches and the scheduled sync. Without it, searches use the connected creator's read-only access." />
            <Setup label="AI Coach" ok={geminiEnabled()} detail="GEMINI_API_KEY. Without it the Coach gives short rule-based answers from your data." />
            <Setup label="Scheduled sync" ok={Boolean(process.env.CRON_SECRET && process.env.YOUTUBE_API_KEY)} detail="CRON_SECRET plus YOUTUBE_API_KEY. Lets a cron job call /api/cron/sync so history builds between visits." />
          </ul>
        </Card>
      </section>

      {showLog && <section>
        <SectionTitle hint="Tokens and keys are removed before anything is logged">Recent activity log</SectionTitle>
        <Card className="p-5">
          {events.length === 0 ? (
            <p className="text-sm text-muted">Nothing logged yet.</p>
          ) : (
            <ul className="space-y-2 font-mono text-xs">
              {events.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 text-faint">{e.at.slice(5, 16)}</span>
                  <span className={e.level === "error" ? "text-bad" : e.level === "warn" ? "text-warn" : "text-muted"}>{e.event}</span>
                  {e.detail && <span className="min-w-0 truncate text-faint">{e.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>}
    </div>
  );
}
