import Link from "next/link";
import { BandBadge, Card, EmptyState, Explain, PageHeader, ProblemState, SectionTitle, SourceBadge, Thumb } from "@/components/ui";
import { getReviews } from "@/features/optimize/data";
import { compact, timeAgo } from "@/lib/format";
import { getViewer } from "@/lib/viewer";
import { isShort } from "@/lib/youtube/types";

export default async function OptimizePage() {
  const viewer = await getViewer();
  const result = await getReviews(viewer);
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Optimize" subtitle="A plain-language review of each recent upload, with the fixes that matter most first." />
        <ProblemState problem={result.problem} retryHref="/optimize" />
      </div>
    );
  }
  const rows = [...result.data.rows].sort((a, b) => b.issues - a.issues);
  const needWork = rows.filter((r) => r.issues >= 3).length;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Optimize" subtitle="A plain-language review of each recent upload, with the fixes that matter most first.">
        <SourceBadge source={result.source} fetchedAt={result.fetchedAt} fromCache={result.fromCache} />
      </PageHeader>

      <div className="mb-6">
        <Explain summary="How uploads are reviewed">
          <p>Each video is run through named checks on its title, description and tags (for example &ldquo;fits without being cut off&rdquo;). You see every check and why it passed or failed.</p>
          <p>Results are bands (Strong, Okay, Needs work), not scores out of 100. Checks that only make sense in English are skipped for titles in Telugu, Hindi and other scripts.</p>
          <p>TubeLens can&apos;t see your thumbnail, so that part is a checklist for you.</p>
        </Explain>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No uploads yet" body="Once this channel has public videos, each one gets a review here." />
      ) : (
        <>
          <SectionTitle hint="Most to fix first">
            {needWork > 0 ? `${needWork} of ${rows.length} recent uploads have 3 or more things to fix` : `${rows.length} recent uploads`}
          </SectionTitle>
          <Card>
            <ul>
              {rows.map(({ video: v, review: r, issues, analytics }) => (
                <li key={v.id} className="border-b border-line/60 last:border-0">
                  <Link href={`/optimize/${v.id}`} className="flex flex-col gap-3 p-4 hover:bg-panel-2 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div className="w-28 shrink-0 sm:w-32">
                        <Thumb src={v.thumbnail} seed={v.id} label={isShort(v) ? "Short" : undefined} title={v.title} />
                      </div>
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-sm leading-snug font-medium">{v.title}</div>
                        <div className="tabular mt-1 text-xs text-muted">
                          {compact(v.views)} views · {timeAgo(v.publishedAt)}
                          {analytics && !isShort(v) ? ` · ${Math.round(analytics.avgViewPercent)}% average watched` : ""}
                        </div>
                        <div className="mt-1 text-xs text-faint">{issues === 0 ? "Nothing to fix" : `${issues} thing${issues === 1 ? "" : "s"} to fix`}</div>
                      </div>
                    </div>
                    <dl className="grid shrink-0 grid-cols-3 gap-3 text-center sm:w-80">
                      {(
                        [
                          ["Title clarity", r.titleClarity.band],
                          ["Topic match", r.topicRelevance.band],
                          ["Hook", r.hook.band],
                        ] as const
                      ).map(([label, b]) => (
                        <div key={label}>
                          <dd><BandBadge band={b} /></dd>
                          <dt className="mt-1 text-[11px] text-muted">{label}</dt>
                        </div>
                      ))}
                    </dl>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
