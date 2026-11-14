import { Badge, Button, Card, ConfidenceBadge, EmptyState, Explain, Field, inputClass, LinkButton, PageHeader, ProblemState, SectionTitle, Select, SourceBadge, Thumb } from "@/components/ui";
import { DEMO_NICHE } from "@/demo/fixtures";
import { getOutliers, type OutlierFilters, type OutlierRow } from "@/features/outliers/data";
import { LANGUAGES, NICHE_EXAMPLES } from "@/features/onboarding/options";
import { compact, duration, timeAgo } from "@/lib/format";
import { pct } from "@/lib/text";
import { getViewer } from "@/lib/viewer";
import { isShort } from "@/lib/youtube/types";

type SP = Promise<Record<string, string | undefined>>;

// YouTube's own video categories, used as the niche filter.
const CATEGORIES: [string, string][] = [
  ["", "Any category"],
  ["28", "Science & technology"],
  ["27", "Education"],
  ["26", "How-to & style"],
  ["20", "Gaming"],
  ["24", "Entertainment"],
  ["22", "People & blogs"],
  ["25", "News & politics"],
  ["17", "Sports"],
  ["10", "Music"],
  ["23", "Comedy"],
  ["19", "Travel & events"],
  ["2", "Autos & vehicles"],
  ["1", "Film & animation"],
];

const pick = <T extends string | number>(value: string | undefined, allowed: T[], fallback: T): T =>
  allowed.find((a) => String(a) === value) ?? fallback;

function OutlierCard({ row, demo }: { row: OutlierRow; demo: boolean }) {
  const { video: v, metrics: m } = row;
  return (
    <Card as="article" className="flex flex-col overflow-hidden">
      <a href={demo ? undefined : `https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer" className="group block p-3 pb-0">
        <div className="relative">
          <Thumb src={v.thumbnail} seed={v.id} label={duration(v.durationSec)} title={v.title} />
          <span className="tabular absolute top-1.5 left-1.5 rounded-md bg-accent px-2 py-0.5 text-xs font-bold text-white">{m.outlierScore}× usual</span>
          {isShort(v) && <span className="absolute top-1.5 right-1.5 rounded-md bg-black/70 px-2 py-0.5 text-[11px] text-white">Short</span>}
        </div>
        <h3 className="mt-3 line-clamp-2 text-sm leading-snug font-medium group-hover:text-accent-soft">{v.title}</h3>
      </a>
      <div className="flex flex-1 flex-col px-3 pb-3">
        <p className="mt-1 text-xs text-muted">
          {v.channelTitle} · {v.channel.subscribers === null ? "subscribers hidden" : `${compact(v.channel.subscribers)} subscribers`} · {timeAgo(v.publishedAt)}
        </p>
        <dl className="tabular mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["Views per subscriber", m.viewsPerSub === null ? "n/a" : `${m.viewsPerSub}×`],
            ["Views a day", compact(m.viewsPerDay)],
            ["Engagement", m.engagementRate === null ? "n/a" : pct(m.engagementRate, 1)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-panel-2 px-1.5 py-2">
              <dd className="text-sm font-semibold">{value}</dd>
              <dt className="mt-0.5 text-[10px] leading-tight text-muted">{label}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[11px] font-medium tracking-wide text-faint uppercase">Why this is an outlier</p>
        <ul className="mt-1.5 space-y-1.5 text-xs leading-relaxed text-muted">
          {m.reasons.slice(0, 3).map((r) => (
            <li key={r} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-soft" />
              {r}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-3">
          <ConfidenceBadge level={m.confidence} note={m.confidenceNote} />
        </div>
      </div>
    </Card>
  );
}

export default async function OutliersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const demo = viewer.mode === "demo";
  const q = (sp.q ?? "").trim().slice(0, 100) || (demo ? DEMO_NICHE : "");
  const filters: OutlierFilters = {
    q,
    type: pick(sp.type, ["all", "long", "short"], "all"),
    days: pick(sp.days, [7, 30, 90, 365], 90),
    minSubs: pick(sp.minSubs, [0, 1000, 10000, 100000], 0),
    minScore: pick(sp.minScore, [2, 3, 5, 10], 2),
    language: LANGUAGES.find(([c]) => c === sp.lang)?.[0],
    categoryId: CATEGORIES.find(([c]) => c && c === sp.cat)?.[0],
  };
  const result = q ? await getOutliers(viewer, filters) : null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Outliers" subtitle="Videos getting far more views than their channel normally does. Study what made them work, then borrow the structure.">
        {result?.ok && <SourceBadge source={result.source} fetchedAt={result.fetchedAt} fromCache={result.fromCache} />}
      </PageHeader>

      <Card className="mb-6 p-4">
        <form action="/outliers" className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          <div className="col-span-2 md:col-span-4 lg:col-span-8">
            <Field label="Topic">
              <div className="flex gap-2">
                <input name="q" defaultValue={sp.q ?? ""} placeholder={`e.g. ${viewer.prefs.niche ?? "budget phones"}`} className={`${inputClass} flex-1`} required={!demo} />
                <Button variant="primary">Find outliers</Button>
              </div>
            </Field>
          </div>
          <div className="lg:col-span-2"><Field label="Niche"><Select name="cat" value={filters.categoryId ?? ""} options={CATEGORIES} /></Field></div>
          <div className="lg:col-span-1"><Field label="Language"><Select name="lang" value={filters.language ?? ""} options={[["", "Any"], ...LANGUAGES]} /></Field></div>
          <div className="lg:col-span-1"><Field label="Format"><Select name="type" value={filters.type} options={[["all", "All"], ["long", "Long-form"], ["short", "Shorts (≤60s)"]]} /></Field></div>
          <div className="lg:col-span-1"><Field label="Published"><Select name="days" value={String(filters.days)} options={[["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["365", "Last year"]]} /></Field></div>
          <div className="lg:col-span-2"><Field label="Minimum channel size"><Select name="minSubs" value={String(filters.minSubs)} options={[["0", "Any size"], ["1000", "1K+ subscribers"], ["10000", "10K+ subscribers"], ["100000", "100K+ subscribers"]]} /></Field></div>
          <div className="lg:col-span-1"><Field label="Outlier score"><Select name="minScore" value={String(filters.minScore)} options={[["2", "2× or more"], ["3", "3× or more"], ["5", "5× or more"], ["10", "10× or more"]]} /></Field></div>
        </form>
        <div className="mt-3">
          <Explain summary="How the numbers are worked out">
            <p><strong className="text-text">Outlier score</strong> = the video&apos;s views ÷ its channel&apos;s lifetime average views per video (leaving this video out).</p>
            <p><strong className="text-text">Views per subscriber</strong> = views ÷ subscribers. <strong className="text-text">Views a day</strong> = views ÷ days since upload. <strong className="text-text">Engagement</strong> = (likes + comments) ÷ views.</p>
            <p>Everything comes from public YouTube numbers. Thumbnails are shown for you to study; TubeLens doesn&apos;t analyse images. Each new search uses about 1% of the daily YouTube allowance and is saved for 24 hours.</p>
          </Explain>
        </div>
      </Card>

      {!result ? (
        <EmptyState title="Search a topic to find breakout videos" body="Try the niche you make videos about. Results are saved for a day, so coming back is free.">
          {[viewer.prefs.niche, ...NICHE_EXAMPLES].filter((x): x is string => Boolean(x)).slice(0, 4).map((n) => (
            <LinkButton key={n} href={`/outliers?q=${encodeURIComponent(n)}`} size="sm">{n}</LinkButton>
          ))}
        </EmptyState>
      ) : !result.ok ? (
        <ProblemState problem={result.problem} retryHref="/outliers" />
      ) : (
        <>
          {result.data.note && <p className="mb-4 rounded-lg border border-line bg-panel-2 px-4 py-2.5 text-sm text-muted">{result.data.note}</p>}
          {result.data.rows.length === 0 ? (
            <EmptyState
              title="No outliers match these filters"
              body={`YouTube returned ${result.data.scanned} videos for "${q}", but none passed your filters. Try a lower outlier score, a longer date range or any channel size.`}
            >
              <LinkButton href={`/outliers?q=${encodeURIComponent(q)}`} variant="primary">Reset filters</LinkButton>
            </EmptyState>
          ) : (
            <>
              {result.data.patterns.patterns.length > 0 && (
                <section className="mb-6">
                  <SectionTitle hint={`From the top ${result.data.patterns.sample} titles below`}>Title patterns in these outliers</SectionTitle>
                  <Card className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {result.data.patterns.patterns.map((p) => (
                        <Badge key={p.label} title={`e.g. "${p.example}"`}>
                          {p.label} <span className="tabular text-text">{p.count}/{result.data.patterns.sample}</span>
                        </Badge>
                      ))}
                      {result.data.patterns.medianLength !== null && <Badge>Typical length <span className="tabular text-text">{result.data.patterns.medianLength} characters</span></Badge>}
                      {result.data.patterns.scripts.filter((s) => s.script !== "Latin").map((s) => (
                        <Badge key={s.script}>{s.script} script <span className="tabular text-text">{s.count}</span></Badge>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-faint">Counts of simple, checkable patterns. Hover a pattern for an example. Thumbnail patterns aren&apos;t included because TubeLens can&apos;t see images.</p>
                  </Card>
                </section>
              )}
              <SectionTitle hint={`${result.data.rows.length} of ${result.data.scanned} videos scanned`}>Outliers for &ldquo;{q}&rdquo;</SectionTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {result.data.rows.map((row) => (
                  <OutlierCard key={row.video.id} row={row} demo={demo} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
