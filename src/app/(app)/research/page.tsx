import { Button, Card, EmptyState, inputClass, PageHeader, ProblemState, SourceBadge } from "@/components/ui";
import { searchChannels } from "@/features/discovery/channels";
import { compact } from "@/lib/format";
import { getViewer } from "@/lib/viewer";

type SP = Promise<{ q?: string }>;

export default async function ResearchPage({ searchParams }: { searchParams: SP }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const viewer = await getViewer();
  const demo = viewer.mode === "demo";
  const result = q || demo ? await searchChannels(viewer, q) : null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Channel research" subtitle="Find channels to study or track. Only public numbers from YouTube are shown.">
        {result?.ok && <SourceBadge source={result.source} fetchedAt={result.fetchedAt} fromCache={result.fromCache} />}
      </PageHeader>
      <form action="/research" className="mb-6 flex max-w-xl gap-2">
        <input name="q" defaultValue={q} required placeholder="Search channels, e.g. Telugu tech" className={`${inputClass} flex-1`} />
        <Button variant="primary">Search</Button>
      </form>

      {!result ? (
        <EmptyState title="Search for channels" body="Each new search uses about 1% of the daily YouTube allowance and is saved for 24 hours." />
      ) : !result.ok ? (
        <ProblemState problem={result.problem} retryHref="/research" />
      ) : result.data.length === 0 ? (
        <EmptyState title="No channels found" body={`YouTube returned nothing for "${q}". Try a broader phrase.`} />
      ) : (
        <>
          {demo && <p className="mb-4 rounded-lg border border-line bg-panel-2 px-4 py-2.5 text-sm text-muted">Demo mode shows one fixed set of example channels, whatever you search for.</p>}
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 text-right font-medium">Subscribers</th>
                  <th className="px-4 py-3 text-right font-medium">Videos</th>
                  <th className="px-4 py-3 text-right font-medium" title="Total views ÷ number of videos, over the channel's whole life">Lifetime views per video</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {result.data.map((c) => (
                  <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-panel-2">
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.title}</div>
                      <div className="text-xs text-muted">{[c.handle, c.country].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="tabular px-4 py-3 text-right">{c.subscribers === null ? "Hidden" : compact(c.subscribers)}</td>
                    <td className="tabular px-4 py-3 text-right">{c.videoCount.toLocaleString("en-IN")}</td>
                    <td className="tabular px-4 py-3 text-right">{c.videoCount > 0 ? compact(Math.round(c.totalViews / c.videoCount)) : "n/a"}</td>
                    <td className="px-4 py-3 text-right">
                      {!demo && (
                        <a href={`https://www.youtube.com/channel/${c.id}`} target="_blank" rel="noreferrer" className="text-xs text-accent-soft hover:underline">Open on YouTube</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="mt-3 text-xs text-faint">Earnings aren&apos;t shown: YouTube doesn&apos;t publish them and any figure would be a guess. To follow a channel over time, add it under Competitors.</p>
        </>
      )}
    </div>
  );
}
