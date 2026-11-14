import { addCompetitorAction, removeCompetitorAction } from "@/app/actions";
import { Badge, Button, Card, Delta, EmptyState, Explain, inputClass, PageHeader, ProblemState, SectionTitle, SourceBadge } from "@/components/ui";
import { getCompetitors, MAX_COMPETITORS, type TrackedChannel } from "@/features/competitors/data";
import { compact } from "@/lib/format";
import { pct } from "@/lib/text";
import { getViewer } from "@/lib/viewer";

type SP = Promise<{ error?: string; added?: string }>;

const dash = <span className="text-faint">n/a</span>;

function CompareRow({ t, own, canRemove }: { t: TrackedChannel; own?: boolean; canRemove: boolean }) {
  const s = t.summary;
  return (
    <tr className={`border-b border-line/60 last:border-0 ${own ? "bg-accent/[0.06]" : ""}`}>
      <td className="px-4 py-3">
        <div className="font-medium">{t.channel.title} {own && <Badge tone="accent">You</Badge>}</div>
        <div className="text-xs text-muted">{t.channel.handle ?? ""}</div>
      </td>
      <td className="tabular px-4 py-3 text-right">{t.channel.subscribers === null ? "Hidden" : compact(t.channel.subscribers)}</td>
      <td className="tabular px-4 py-3 text-right">{s.uploadsPerWeek ?? dash}</td>
      <td className="tabular px-4 py-3 text-right">{s.medianViews === null ? dash : compact(s.medianViews)}</td>
      <td className="tabular px-4 py-3 text-right">{s.shortsShare === null ? dash : pct(s.shortsShare)}</td>
      <td className="tabular px-4 py-3 text-right text-xs">
        {t.change ? (
          <>
            {t.change.subscribers !== null && <div><Delta value={t.change.subscribers} suffix=" subs" /></div>}
            {t.change.views !== null && <div><Delta value={t.change.views} suffix=" views" /></div>}
          </>
        ) : (
          <span className="text-faint">Collecting ({Math.min(t.historyDays, 7)}/7 days)</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {canRemove && !own && (
          <form action={removeCompetitorAction}>
            <input type="hidden" name="channelId" value={t.channel.id} />
            <button className="text-xs text-faint hover:text-text" aria-label={`Stop tracking ${t.channel.title}`}>Remove</button>
          </form>
        )}
      </td>
    </tr>
  );
}

export default async function CompetitorsPage({ searchParams }: { searchParams: SP }) {
  const { error, added } = await searchParams;
  const viewer = await getViewer();
  const result = await getCompetitors(viewer);
  const live = viewer.mode === "live";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Competitors" subtitle="Track channels in your space: how often they upload, what works for them, and what they cover that you don't.">
        {result.ok && <SourceBadge source={result.source} />}
      </PageHeader>

      {error && <div role="alert" className="mb-5 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">{error}</div>}
      {added && <div role="status" className="mb-5 rounded-lg border border-good/30 bg-good/10 px-4 py-3 text-sm text-good">Channel added. Weekly change appears after 7 days of snapshots.</div>}

      {!result.ok ? (
        <ProblemState problem={result.problem} retryHref="/competitors" />
      ) : (
        <>
          <Card className="mb-6 p-4">
            <form action={addCompetitorAction} className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-muted">
                Add a channel to track
                <input name="channel" required disabled={!live} placeholder="Paste a channel URL, @handle or channel ID" className={`${inputClass} w-full disabled:opacity-50`} />
              </label>
              <Button variant="primary" disabled={!live}>Track channel</Button>
            </form>
            <p className="mt-2 text-xs text-faint">
              {live ? `Up to ${MAX_COMPETITORS} channels. Only public numbers are read; the channel is never notified.` : "Demo mode shows three example channels. Switch off Demo mode to track real ones."}
            </p>
          </Card>

          {result.data.competitors.length === 0 ? (
            <EmptyState title="No channels tracked yet" body="Add two or three channels that make videos for the same audience as you. TubeLens will compare them with your channel and take a daily snapshot so you can see how they grow." />
          ) : (
            <>
              <section className="mb-8">
                <SectionTitle hint="From each channel's most recent public uploads">Side by side</SectionTitle>
                <Card className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-muted">
                        <th className="px-4 py-3 font-medium">Channel</th>
                        <th className="px-4 py-3 text-right font-medium">Subscribers</th>
                        <th className="px-4 py-3 text-right font-medium">Uploads / week</th>
                        <th className="px-4 py-3 text-right font-medium">Typical views</th>
                        <th className="px-4 py-3 text-right font-medium">Shorts share</th>
                        <th className="px-4 py-3 text-right font-medium">Change this week</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.own && <CompareRow t={result.data.own} own canRemove={false} />}
                      {result.data.competitors.map((t) => (
                        <CompareRow key={t.channel.id} t={t} canRemove={live} />
                      ))}
                    </tbody>
                  </table>
                </Card>
                <div className="mt-3">
                  <Explain>
                    <p><strong className="text-text">Uploads / week</strong>: uploads in the last 8 weeks ÷ 8. <strong className="text-text">Typical views</strong>: the median of the recent uploads sampled (up to 20 for competitors). <strong className="text-text">Shorts share</strong>: videos of 60 seconds or less.</p>
                    <p><strong className="text-text">Change this week</strong> compares TubeLens&apos;s own daily snapshots 7 days apart, so it starts a week after you add a channel. YouTube rounds public subscriber counts, so small changes may not show.</p>
                  </Explain>
                </div>
              </section>

              <section className="mb-8">
                <SectionTitle hint="Topics they cover with above-typical results that never appear in your titles or tags">Content gaps</SectionTitle>
                {result.data.gaps.length === 0 ? (
                  <Card className="p-5 text-sm text-muted">
                    {result.data.own ? "No clear gaps found: your recent titles and tags already cover the topics that work for these channels." : "Connect your channel to compare its topics with these channels."}
                  </Card>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {result.data.gaps.map((g) => (
                      <Card key={g.topic} className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">&ldquo;{g.topic}&rdquo;</h3>
                          <a href={`/keywords?q=${encodeURIComponent(g.topic)}`} className="text-xs text-accent-soft hover:underline">Check keyword</a>
                        </div>
                        <ul className="mt-2 space-y-2 text-xs text-muted">
                          {g.examples.map((e, i) => (
                            <li key={i}>
                              <span className="line-clamp-2 text-text/90">{e.title}</span>
                              <span className="tabular">{e.channelTitle} · {compact(e.views)} views</span>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <SectionTitle>What works for each channel</SectionTitle>
                <div className="grid gap-4 lg:grid-cols-3">
                  {result.data.competitors.map((t) => (
                    <Card key={t.channel.id} className="p-5">
                      <h3 className="text-sm font-semibold">{t.channel.title}</h3>
                      <p className="mt-3 text-xs font-medium text-muted">Top recent videos</p>
                      <ul className="mt-1.5 space-y-2 text-sm">
                        {t.summary.topVideos.map((v) => (
                          <li key={v.id}>
                            <span className="line-clamp-2 leading-snug">{v.title}</span>
                            <span className="tabular text-xs text-muted">{compact(v.views)} views</span>
                          </li>
                        ))}
                      </ul>
                      {t.summary.topics.length > 0 && (
                        <>
                          <p className="mt-4 text-xs font-medium text-muted">Recurring topics</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">{t.summary.topics.map((x) => <Badge key={x}>{x}</Badge>)}</div>
                        </>
                      )}
                      {t.summary.titlePatterns.length > 0 && (
                        <>
                          <p className="mt-4 text-xs font-medium text-muted">Title patterns</p>
                          <ul className="mt-1.5 space-y-1 text-xs text-muted">
                            {t.summary.titlePatterns.map((p) => (
                              <li key={p.label} className="tabular">{p.label}: {p.count} of {t.summary.sample}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </Card>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
