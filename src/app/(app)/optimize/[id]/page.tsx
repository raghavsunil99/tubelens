import Link from "next/link";
import { notFound } from "next/navigation";
import { BandBadge, Card, CheckList, LinkButton, PageHeader, ProblemState, SectionTitle, SourceBadge, Stat, Thumb } from "@/components/ui";
import { getReview } from "@/features/optimize/data";
import { compact, duration, timeAgo } from "@/lib/format";
import { getViewer } from "@/lib/viewer";
import { isShort } from "@/lib/youtube/types";

export default async function VideoReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  const result = await getReview(viewer, id);
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Video review" />
        <ProblemState problem={result.problem} retryHref={`/optimize/${id}`} />
      </div>
    );
  }
  if (!result.data) notFound();
  const { video: v, review: r, retentionAt30s } = result.data;
  const coachPrompt = `Improve this title and thumbnail concept. Current title: "${v.title}". Give me 5 better titles and a thumbnail idea for each.`;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/optimize" className="mb-4 inline-block text-sm text-muted hover:text-text">← All uploads</Link>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="w-full shrink-0 sm:w-64">
          <Thumb src={v.thumbnail} seed={v.id} label={duration(v.durationSec)} title={v.title} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2"><SourceBadge source={result.source} fetchedAt={result.fetchedAt} fromCache={result.fromCache} /></div>
          <h1 className="text-xl leading-snug font-semibold tracking-tight text-balance">{v.title}</h1>
          <p className="tabular mt-2 text-sm text-muted">
            {compact(v.views)} views · {v.likes === null ? "likes hidden" : `${compact(v.likes)} likes`} · {v.comments === null ? "comments off" : `${compact(v.comments)} comments`} · {timeAgo(v.publishedAt)} · {isShort(v) ? "Short" : "Long-form"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href={`/ai-coach?prompt=${encodeURIComponent(coachPrompt)}`} variant="primary" icon="arrow">Ask the Coach for better titles</LinkButton>
            {result.source === "youtube" && <LinkButton href={`https://studio.youtube.com/video/${v.id}/edit`} icon="external">Edit in YouTube Studio</LinkButton>}
          </div>
        </div>
      </div>

      {r.suggestions.length > 0 && (
        <section className="mb-8">
          <SectionTitle hint="From the failed checks below">Fix these first</SectionTitle>
          <Card className="p-5">
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed marker:text-faint">
              {r.suggestions.slice(0, 6).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </Card>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">Title clarity</h2><BandBadge band={r.titleClarity.band} /></div>
          <CheckList checks={r.titleClarity.checks} />
        </Card>
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">Hook strength</h2><BandBadge band={r.hook.band} /></div>
          <CheckList checks={r.hook.checks} />
        </Card>
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">Topic relevance</h2><BandBadge band={r.topicRelevance.band} /></div>
          <p className="text-sm leading-relaxed text-muted">{r.topicRelevance.detail}</p>
          <p className="mt-3 text-xs text-faint">Compares the words in your title with your tags and the first lines of the description.</p>
        </Card>
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">Description checklist</h2><BandBadge band={r.description.band} /></div>
          <CheckList checks={r.description.checks} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 text-sm font-semibold">Thumbnail checklist</h2>
          <p className="mb-4 text-xs text-faint">TubeLens can&apos;t see images, so check these yourself.</p>
          <ul className="space-y-2.5 text-sm">
            {r.thumbnailChecklist.map((item) => (
              <li key={item}>
                <label className="flex cursor-pointer gap-2.5">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-(--accent)" />
                  <span className="leading-snug text-muted">{item}</span>
                </label>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">First 30 seconds</h2>
          {(retentionAt30s !== null || r.retention.measured) && (
            <div className="mb-4 grid grid-cols-2 gap-3">
              {retentionAt30s !== null && <Stat label="Still watching at 0:30" value={`${Math.round(retentionAt30s * 100)}%`} note="From this video's retention curve in YouTube Analytics." />}
              {r.retention.measured && <Stat label="Average watched" value={`${Math.round(r.retention.measured.avgViewPercent)}%`} sub={`${duration(r.retention.measured.avgViewDurationSec)} of ${duration(v.durationSec)}`} />}
            </div>
          )}
          {retentionAt30s === null && (
            <p className="mb-3 text-xs leading-relaxed text-faint">
              {isShort(v) || v.durationSec <= 30
                ? "This video is too short for a 30-second retention figure."
                : result.source === "demo"
                  ? "Demo mode has no retention curve. With a connected channel, the real share of viewers still watching at 0:30 appears here."
                  : "YouTube returned no retention curve for this video, so there is no measured 30-second figure."}
            </p>
          )}
          <p className="text-sm leading-relaxed text-muted">{r.retention.hypothesis}</p>
        </Card>
      </div>

      <section className="mt-8">
        <SectionTitle hint="Mechanical fixes only. For creative options, ask the Coach.">Before and after</SectionTitle>
        <Card className="p-5">
          <p className="text-xs text-muted">Current</p>
          <p className="mt-1 text-sm font-medium">{v.title}</p>
          {r.rewrites.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No mechanical fix applies to this title. Its length, capitals and punctuation are fine.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {r.rewrites.map((w) => (
                <li key={w.title} className="rounded-lg border border-line/60 bg-panel-2/50 px-4 py-3">
                  <p className="text-sm font-medium">{w.title}</p>
                  <p className="mt-1 text-xs text-muted">{w.why}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
