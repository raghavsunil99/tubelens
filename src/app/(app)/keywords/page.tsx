import { PageHeader, Panel, SearchForm } from "@/components/ui";
import { getKeywordTrends } from "@/lib/data";
import { compact, scoreColor } from "@/lib/format";

type SP = Promise<{ q?: string }>;

function Bar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-line">
        <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-6 text-right text-xs">{value}</span>
    </div>
  );
}

export default async function KeywordsPage({ searchParams }: { searchParams: SP }) {
  const { q } = await searchParams;
  let rows = await getKeywordTrends(q);
  if (q) {
    const f = rows.filter((r) => r.keyword.includes(q.toLowerCase()));
    if (f.length) rows = f;
  }
  rows = [...rows].sort((a, b) => b.overall - a.overall);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Keyword research"
        subtitle="Overall score rewards high search volume and low competition."
      >
        <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">Demo data</span>
      </PageHeader>
      <div className="mb-6">
        <SearchForm action="/keywords" name="q" defaultValue={q} placeholder="Enter a keyword" />
      </div>

      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Keyword</th>
              <th className="px-4 py-3 font-medium">Volume</th>
              <th className="px-4 py-3 font-medium">Competition</th>
              <th className="px-4 py-3 text-right font-medium">Est. monthly</th>
              <th className="px-4 py-3 text-right font-medium">7-day trend</th>
              <th className="px-4 py-3 text-right font-medium">Overall</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k.keyword} className="border-b border-line/60 last:border-0 hover:bg-panel-2">
                <td className="px-4 py-3 font-medium">{k.keyword}</td>
                <td className="px-4 py-3">
                  <Bar value={k.volume} tone="bg-good" />
                </td>
                <td className="px-4 py-3">
                  <Bar value={k.competition} tone="bg-bad" />
                </td>
                <td className="px-4 py-3 text-right">{compact(k.estimated_monthly_search)}</td>
                <td className={`px-4 py-3 text-right ${k.period_percent_change >= 0 ? "text-good" : "text-bad"}`}>
                  {k.period_percent_change >= 0 ? "+" : ""}
                  {k.period_percent_change}%
                </td>
                <td className={`px-4 py-3 text-right text-base font-semibold ${scoreColor(k.overall)}`}>{k.overall}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
