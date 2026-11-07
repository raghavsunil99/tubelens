import { PageHeader, Panel, SearchForm, SourceBadge } from "@/components/ui";
import { searchChannelDirectory } from "@/lib/data";
import { compact } from "@/lib/format";

type SP = Promise<{ q?: string }>;

export default async function ResearchPage({ searchParams }: { searchParams: SP }) {
  const { q } = await searchParams;
  const { source, data } = await searchChannelDirectory(q);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Channel research" subtitle="Find channels by niche, size and earnings to study or partner with.">
        <SourceBadge source={source} />
      </PageHeader>
      <div className="mb-6">
        <SearchForm action="/research" name="q" defaultValue={q} placeholder="Search channels or niches" />
      </div>

      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Channel</th>
              <th className="px-4 py-3 font-medium">Niche</th>
              <th className="px-4 py-3 text-right font-medium">Subscribers</th>
              <th className="px-4 py-3 text-right font-medium">Avg views</th>
              <th className="px-4 py-3 text-right font-medium">Videos</th>
              <th className="px-4 py-3 text-right font-medium">Est. earnings</th>
              <th className="px-4 py-3 font-medium">Tags</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.channelId} className="border-b border-line/60 last:border-0 hover:bg-panel-2">
                <td className="px-4 py-3">
                  <div className="font-medium">{c.channelTitle}</div>
                  <div className="text-xs text-muted">
                    {c.handle} {c.country && `· ${c.country}`}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {c.niche}
                  {c.nicheConfidence > 0 && (
                    <span className="ml-1 text-xs text-muted">{Math.round(c.nicheConfidence * 100)}%</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{compact(c.subscriberCount)}</td>
                <td className="px-4 py-3 text-right">{compact(c.avgViews)}</td>
                <td className="px-4 py-3 text-right">{c.videoCount}</td>
                <td className="px-4 py-3 text-right">${compact(c.estimatedEarnings)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {c.isFaceless && <span className="rounded bg-panel-2 px-2 py-0.5 text-xs">Faceless</span>}
                    {c.isPodcast && <span className="rounded bg-panel-2 px-2 py-0.5 text-xs">Podcast</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
