import { PageHeader, Panel, SourceBadge, Thumb } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getOptimizeVideos } from "@/lib/data";
import { compact, scoreColor, timeAgo } from "@/lib/format";

function average(values: (number | null)[]) {
  const nums = values.filter((v): v is number => v !== null);
  return nums.length ? Math.round(nums.reduce((s, v) => s + v, 0) / nums.length) : null;
}

export default async function OptimizePage() {
  const session = await getSession();
  const { source, data: videos } = await getOptimizeVideos(session);
  const avgTitle = average(videos.map((v) => v.titleScore));
  const avgThumb = average(videos.map((v) => v.thumbnailScore));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Optimize" subtitle="Title and thumbnail scores for your recent uploads. Fix the lowest first.">
        <SourceBadge source={source} />
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <Panel className="p-4">
          <div className="text-xs text-muted">Average title score</div>
          <div className={`mt-1 text-2xl font-semibold ${scoreColor(avgTitle)}`}>{avgTitle ?? "—"}</div>
        </Panel>
        <Panel className="p-4">
          <div className="text-xs text-muted">Average thumbnail score</div>
          <div className={`mt-1 text-2xl font-semibold ${scoreColor(avgThumb)}`}>{avgThumb ?? "—"}</div>
        </Panel>
      </div>

      {videos.length === 0 ? (
        <Panel className="p-8 text-center text-muted">No uploads found on this channel yet.</Panel>
      ) : (
        <Panel>
          {videos.map((v) => (
            <a
              key={v.id}
              href={source === "youtube" ? `https://www.youtube.com/watch?v=${v.id}` : undefined}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-4 border-b border-line/60 p-4 last:border-0 hover:bg-panel-2"
            >
              <div className="w-28 shrink-0 sm:w-36">
                <Thumb
                  src={v.thumbnail}
                  seed={v.id}
                  label={v.videoType === "short" ? "Short" : undefined}
                  title={v.title}
                  niche="Tech"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-sm font-medium">{v.title}</div>
                <div className="mt-1 text-xs text-muted">
                  {compact(v.viewCount)} views · {timeAgo(v.publishedAt)}
                </div>
              </div>
              {v.titleScore === null ? (
                <span className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs text-muted">Not scored yet</span>
              ) : (
                <div className="flex gap-5 text-center">
                  <div>
                    <div className={`text-lg font-semibold ${scoreColor(v.titleScore)}`}>{v.titleScore}</div>
                    <div className="text-[11px] text-muted">Title</div>
                  </div>
                  <div>
                    <div className={`text-lg font-semibold ${scoreColor(v.thumbnailScore)}`}>{v.thumbnailScore}</div>
                    <div className="text-[11px] text-muted">Thumb</div>
                  </div>
                </div>
              )}
            </a>
          ))}
        </Panel>
      )}
    </div>
  );
}
