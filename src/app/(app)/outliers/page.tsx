import Link from "next/link";
import { PageHeader, Panel, SearchForm, SourceBadge, Thumb } from "@/components/ui";
import { getOutliers } from "@/lib/data";
import { compact, duration, timeAgo } from "@/lib/format";

type SP = Promise<{ q?: string; type?: string }>;

export default async function OutliersPage({ searchParams }: { searchParams: SP }) {
  const { q, type } = await searchParams;
  const videoType = type === "short" || type === "long" ? type : "all";
  const { source, data } = await getOutliers({ q, videoType });

  const tab = (value: string, label: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (value !== "all") params.set("type", value);
    const active = videoType === value;
    return (
      <Link
        key={value}
        href={`/outliers${params.size ? `?${params}` : ""}`}
        className={`rounded-lg px-3 py-1.5 text-sm ${active ? "bg-panel-2 text-text" : "text-muted hover:text-text"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Outliers" subtitle="Videos getting far more views than their channel normally does.">
        <SourceBadge source={source} />
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <SearchForm action="/outliers" name="q" defaultValue={q} placeholder="Search a topic, e.g. budget phones" />
        <div className="flex gap-1 rounded-xl border border-line bg-panel p-1">
          {tab("all", "All")}
          {tab("long", "Long-form")}
          {tab("short", "Shorts")}
        </div>
      </div>

      {data.length === 0 ? (
        <Panel className="p-8 text-center text-muted">No outliers match those filters.</Panel>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((v) => (
            <a
              key={v.video_id}
              href={v.video_id.startsWith("vid_") ? undefined : `https://www.youtube.com/watch?v=${v.video_id}`}
              target="_blank"
              rel="noreferrer"
              className="group"
            >
              <div className="relative">
                <Thumb src={v.video_thumbnail} seed={v.video_id} label={duration(v.video_duration)} />
                <span className="absolute top-1.5 left-1.5 rounded-md bg-warn px-2 py-0.5 text-xs font-bold text-black">
                  {v.outlier_score}x
                </span>
              </div>
              <h3 className="mt-2 line-clamp-2 text-sm font-medium group-hover:text-accent">{v.video_title}</h3>
              <p className="mt-1 text-xs text-muted">
                {v.channel_title} · {compact(v.subscriber_count)} subs
              </p>
              <p className="text-xs text-muted">
                {compact(v.view_count)} views vs {compact(v.avg_views)} avg · {timeAgo(v.video_published_at)}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
