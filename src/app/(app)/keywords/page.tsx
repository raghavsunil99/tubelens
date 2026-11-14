import { forgetKeywordAction, saveIdeaAction } from "@/app/actions";
import { Badge, Button, Card, ConfidenceBadge, EmptyState, Explain, inputClass, LinkButton, PageHeader, ProblemState, SectionTitle, SourceBadge } from "@/components/ui";
import { getKeyword, listKeywords } from "@/features/keywords/data";
import type { KeywordAnalysis, Opportunity } from "@/features/keywords/score";
import { compact } from "@/lib/format";
import { getViewer } from "@/lib/viewer";

type SP = Promise<{ q?: string }>;

const OPP_TONE: Record<Opportunity, "good" | "warn" | "neutral"> = { High: "good", Medium: "warn", Low: "neutral", "Insufficient data": "neutral" };
const LEVEL_TONE = { Low: "good", Medium: "warn", High: "bad", Unknown: "neutral" } as const;

function Row({ label, value, detail }: { label: string; value: React.ReactNode; detail: string }) {
  return (
    <div className="grid gap-1 border-t border-line/60 py-3.5 first:border-0 sm:grid-cols-[10rem_1fr]">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd>
        <div className="text-sm font-medium">{value}</div>
        <p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p>
      </dd>
    </div>
  );
}

function Analysis({ a }: { a: KeywordAnalysis }) {
  return (
    <dl>
      <Row label="Search intent" value={a.intent.label} detail={a.intent.basis} />
      <Row label="Competition (estimate)" value={<Badge tone={LEVEL_TONE[a.competition.level]}>{a.competition.level}</Badge>} detail={a.competition.detail} />
      <Row label="Trend direction" value={a.trend.direction} detail={a.trend.detail} />
      <Row label="Content gap" value={a.gap.found ? <Badge tone="good">Gap found</Badge> : "None found"} detail={a.gap.detail} />
      <Row
        label="Related phrases"
        value={
          a.related.length ? (
            <span className="flex flex-wrap gap-1.5">
              {a.related.map((r) => (
                <a key={r} href={`/keywords?q=${encodeURIComponent(r)}`} className="rounded-full border border-line px-2.5 py-0.5 text-xs font-normal text-muted hover:border-accent hover:text-text">
                  {r}
                </a>
              ))}
            </span>
          ) : (
            "None found"
          )
        }
        detail="Tags and word pairs that repeat across the top results. Tap one to analyse it."
      />
    </dl>
  );
}

export default async function KeywordsPage({ searchParams }: { searchParams: SP }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const viewer = await getViewer();
  const result = q ? await getKeyword(viewer, q, viewer.prefs.language ?? undefined) : null;
  const history = listKeywords(viewer).filter((k) => k.phrase.toLowerCase() !== q.toLowerCase());
  const a = result?.ok ? result.data.analysis : null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Keywords" subtitle="See who ranks for a phrase and whether there's room for you, before you film.">
        {result?.ok && <SourceBadge source={result.source} fetchedAt={result.fetchedAt} fromCache={result.fromCache} />}
      </PageHeader>

      <form action="/keywords" className="mb-3 flex max-w-xl gap-2">
        <input name="q" defaultValue={q} required placeholder="Enter a keyword, e.g. best phone under 15000" className={`${inputClass} flex-1`} />
        <Button variant="primary">Analyse</Button>
      </form>
      <div className="mb-8">
        <Explain summary="What TubeLens can and can't tell you about a keyword">
          <p>YouTube does not publish search volume, so TubeLens never shows one. Tools that do are estimating.</p>
          <p>Instead it reads the top results for the phrase: how big the ranking channels are, how recent the videos are, and whether small channels are getting through. That gives a <strong className="text-text">relative opportunity</strong>, not a forecast of views.</p>
          <p>Each new keyword uses about 1% of the daily YouTube allowance and is saved for 24 hours.</p>
        </Explain>
      </div>

      {result && !result.ok && <ProblemState problem={result.problem} retryHref={`/keywords?q=${encodeURIComponent(q)}`} />}

      {a && result?.ok && (
        <div className="mb-10 grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted">Keyword</p>
                <h2 className="text-xl font-semibold tracking-tight">{a.phrase}</h2>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">Relative opportunity</p>
                <Badge tone={OPP_TONE[a.opportunity]}>{a.opportunity}</Badge>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{a.opportunityWhy}</p>
            {result.data.note && <p className="mt-3 rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs text-muted">{result.data.note}</p>}
            <div className="mt-4">
              <Analysis a={a} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-4">
              <ConfidenceBadge level={a.confidence} note={a.confidenceNote} />
              <p className="text-xs text-faint">Source: top {a.sample} YouTube search results{result.source === "demo" ? " (demo sample)" : ""}</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-faint">{a.confidenceNote}</p>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <SectionTitle>A place to start</SectionTitle>
              <dl className="space-y-3 text-sm">
                <div><dt className="text-xs text-muted">Suggested title</dt><dd className="mt-0.5 font-medium">{a.suggestion.title}</dd></div>
                <div><dt className="text-xs text-muted">Suggested hook</dt><dd className="mt-0.5 leading-relaxed">{a.suggestion.hook}</dd></div>
                <div><dt className="text-xs text-muted">Suggested format</dt><dd className="mt-0.5 leading-relaxed">{a.suggestion.format}</dd></div>
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-faint">The title and hook are fill-in templates chosen by search intent. Rewrite them so they&apos;re true for your video.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <form action={saveIdeaAction}>
                  <input type="hidden" name="ref" value={`keyword:${a.phrase}`} />
                  <input type="hidden" name="kind" value="keyword" />
                  <input type="hidden" name="title" value={a.suggestion.title} />
                  <input type="hidden" name="body" value={`Keyword "${a.phrase}": ${a.opportunity.toLowerCase()} relative opportunity. ${a.suggestion.format}`} />
                  <input type="hidden" name="href" value={`/keywords?q=${encodeURIComponent(a.phrase)}`} />
                  <Button size="sm">Save idea</Button>
                </form>
                <LinkButton size="sm" variant="primary" href={`/ai-coach?prompt=${encodeURIComponent(`Write 5 title options and an opening hook for a video on "${a.phrase}", in my channel's language.`)}`}>
                  Ask the Coach
                </LinkButton>
              </div>
            </Card>
            <Card className="p-5">
              <SectionTitle>Who ranks now</SectionTitle>
              <ul className="space-y-3 text-sm">
                {result.data.topResults.map((v) => (
                  <li key={v.id}>
                    <div className="line-clamp-2 leading-snug">{v.title}</div>
                    <div className="tabular mt-0.5 text-xs text-muted">
                      {v.channelTitle} · {v.subscribers === null ? "hidden" : compact(v.subscribers)} subs · {compact(v.views)} views
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {!q && history.length === 0 && (
        <EmptyState title="Analyse your first keyword" body="Type a phrase you'd want your next video to be found for. You'll see who ranks, how tough it looks and a starting title." />
      )}

      {history.length > 0 && (
        <section>
          <SectionTitle hint="Reopening one is free while its results are saved">{q ? "Other keywords you've analysed" : "Keywords you've analysed"}</SectionTitle>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-3 font-medium">Keyword</th>
                  <th className="px-4 py-3 font-medium">Relative opportunity</th>
                  <th className="px-4 py-3 font-medium">Competition</th>
                  <th className="px-4 py-3 font-medium">Trend</th>
                  <th className="px-4 py-3 font-medium">Gap</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {history.map((k) => (
                  <tr key={k.phrase} className="border-b border-line/60 last:border-0 hover:bg-panel-2">
                    <td className="px-4 py-3 font-medium">
                      <a href={`/keywords?q=${encodeURIComponent(k.phrase)}`} className="hover:text-accent-soft">{k.phrase}</a>
                    </td>
                    <td className="px-4 py-3"><Badge tone={OPP_TONE[k.opportunity]}>{k.opportunity}</Badge></td>
                    <td className="px-4 py-3 text-muted">{k.competition.level}</td>
                    <td className="px-4 py-3 text-muted">{k.trend.direction}</td>
                    <td className="px-4 py-3 text-muted">{k.gap.found ? "Found" : "None"}</td>
                    <td className="px-4 py-3 text-right">
                      {viewer.mode === "live" && <form action={forgetKeywordAction}>
                        <input type="hidden" name="phrase" value={k.phrase} />
                        <button className="text-xs text-faint hover:text-text" aria-label={`Remove ${k.phrase}`}>Remove</button>
                      </form>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}
    </div>
  );
}
