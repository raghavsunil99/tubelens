import { PageHeader, Panel } from "@/components/ui";
import { getCompetitors } from "@/lib/data";
import { compact } from "@/lib/format";

export default async function CompetitorsPage() {
  const competitors = await getCompetitors();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Competitors"
        subtitle="Channels in your niche, matched automatically by topic, language and audience size."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {competitors.map((c, i) => (
          <Panel key={c.channel_id} className="flex items-center gap-4 p-4">
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-semibold text-white"
              style={{ background: `hsl(${(i * 47) % 360} 55% 40%)` }}
            >
              {c.channel_title[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{c.channel_title}</div>
              <div className="text-xs text-muted">
                {compact(c.subscriber_count)} subs · {c.sub_niche}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">{Math.round(c.score * 100)}%</div>
              <div className="text-xs text-muted">match</div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
