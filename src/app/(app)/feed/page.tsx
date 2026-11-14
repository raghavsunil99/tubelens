import { Card, Delta, EmptyState, LinkButton, PageHeader, ProblemState, SectionTitle, SourceBadge, Stat } from "@/components/ui";
import { TrendChart, type TrendPoint } from "@/components/ui/TrendChart";
import { getFeed } from "@/features/feed/data";
import { FeedCardView } from "@/features/feed/FeedCardView";
import { compact } from "@/lib/format";
import { getViewer } from "@/lib/viewer";

const AUTH_ERRORS: Record<string, string> = {
  not_configured: "YouTube sign-in isn't set up yet. Add the Google OAuth values to .env.local.",
  access_denied: "You cancelled the YouTube connection. Nothing was shared.",
  state_mismatch: "The sign-in link expired or was opened in another browser. Please try again.",
  youtube_scope_denied: "YouTube access wasn't granted, so TubeLens can't read your channel. Please allow it and try again.",
  token_exchange_failed: "Google sign-in failed. Check the server log and your OAuth client settings.",
  no_channel: "Connected, but this Google account has no YouTube channel.",
};

type SP = Promise<{ auth_error?: string }>;

export default async function FeedPage({ searchParams }: { searchParams: SP }) {
  const { auth_error } = await searchParams;
  const viewer = await getViewer();
  const result = await getFeed(viewer);

  const banner = auth_error && (
    <div role="alert" className="mb-6 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
      {AUTH_ERRORS[auth_error] ?? "Sign-in didn't complete. Please try again."}
    </div>
  );

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-5xl">
        {banner}
        <PageHeader title="Your feed" subtitle="What to do next for your channel, based on your own numbers." />
        <ProblemState problem={result.problem} retryHref="/feed" />
      </div>
    );
  }

  const { overview, feed, saved } = result.data;
  const { channel, history, uploads, hasAnalytics } = overview;
  const daily = history.filter((d) => d.views !== null);
  const sum = (pick: (d: (typeof daily)[number]) => number | null) => daily.reduce((s, d) => s + (pick(d) ?? 0), 0);
  const views28 = sum((d) => d.views);
  const watchHours = Math.round(sum((d) => d.watchMinutes) / 60);
  const subsNet = sum((d) => d.subsNet);
  const avgDuration = views28 > 0 ? Math.round(daily.reduce((s, d) => s + (d.avgViewDurationSec ?? 0) * (d.views ?? 0), 0) / views28) : null;
  const cutoff = Date.now() - 28 * 86400_000;
  const recentUploads = uploads.filter((v) => new Date(v.publishedAt).getTime() >= cutoff).length;

  const uploadsByDay = new Map<string, string[]>();
  for (const v of uploads) {
    const day = v.publishedAt.slice(0, 10);
    uploadsByDay.set(day, [...(uploadsByDay.get(day) ?? []), v.title]);
  }
  const points: TrendPoint[] = daily.map((d) => ({ day: d.day, value: d.views ?? 0, uploads: uploadsByDay.get(d.day) }));
  const [today, ...rest] = feed.cards;

  return (
    <div className="mx-auto max-w-5xl">
      {banner}
      <PageHeader title={channel.title} subtitle="What to do next for your channel, based on your own numbers.">
        <SourceBadge source={result.source} fetchedAt={result.fetchedAt} fromCache={result.fromCache} />
      </PageHeader>

      {!viewer.prefs.onboardedAt && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted">
            <span className="font-medium text-text">Finish setting up.</span> Tell TubeLens your niche, language and goal so recommendations fit your channel.
          </p>
          <LinkButton href="/onboarding" size="sm" icon="arrow">
            Continue setup
          </LinkButton>
        </Card>
      )}

      {today && (
        <section aria-label="Recommended action for today" className="mb-8 rounded-xl border border-accent/40 bg-accent/[0.08] p-5 md:p-6">
          <p className="text-xs font-medium tracking-wide text-accent-soft uppercase">One thing to do today</p>
          <p className="mt-2 text-lg leading-snug font-semibold text-balance md:text-xl">{today.today}</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{today.why}</p>
          <div className="mt-4">
            <LinkButton href={today.action.href} variant="primary" icon="arrow">
              {today.action.label}
            </LinkButton>
          </div>
        </section>
      )}

      <section className="mb-8">
        <SectionTitle hint={hasAnalytics ? "Last 28 days, from YouTube Analytics (can lag by 2 to 3 days)" : undefined}>Channel health</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Subscribers"
            value={channel.subscribers === null ? "Hidden" : compact(channel.subscribers)}
            sub={hasAnalytics ? <><Delta value={subsNet} /> in 28 days</> : undefined}
            note={channel.subscribers !== null && channel.subscribers >= 1000 ? "YouTube rounds public subscriber counts." : undefined}
          />
          {hasAnalytics ? (
            <>
              <Stat label="Views" value={compact(views28)} sub={`${compact(channel.totalViews)} all time`} />
              <Stat label="Watch time" value={`${compact(watchHours)} hrs`} sub={avgDuration ? `${Math.floor(avgDuration / 60)}:${String(avgDuration % 60).padStart(2, "0")} average view` : undefined} />
            </>
          ) : (
            <>
              <Stat label="Total views" value={compact(channel.totalViews)} sub="All time" />
              <Stat label="Watch time" value="Not available" note="YouTube Analytics returned no data for this channel. This is normal for new channels." />
            </>
          )}
          <Stat label="Uploads" value={recentUploads} sub={`in 28 days · ${channel.videoCount} total`} />
        </div>
      </section>

      {points.length >= 2 && (
        <section className="mb-8">
          <SectionTitle hint="Hover the line for a day's number">Daily views</SectionTitle>
          <Card className="p-4 md:p-5">
            <TrendChart points={points} unit="views" />
          </Card>
        </section>
      )}

      <section>
        <SectionTitle hint={`${feed.cards.length} card${feed.cards.length === 1 ? "" : "s"} · saved cards are kept under Saved`}>For you</SectionTitle>
        {feed.cards.length === 0 ? (
          <EmptyState title="You're all caught up" body="Every card has been dismissed. New ones appear as your numbers change." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[today, ...rest].filter(Boolean).map((card) => (
              <FeedCardView key={card!.key} card={card!} saved={saved.has(card!.key)} />
            ))}
          </div>
        )}
        {feed.notes.length > 0 && (
          <ul className="mt-5 space-y-1.5 text-xs leading-relaxed text-faint">
            {feed.notes.map((n) => (
              <li key={n}>· {n}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
