import { removeIdeaAction } from "@/app/actions";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SourceBadge } from "@/components/ui";
import { listSaved } from "@/features/feed/data";
import { timeAgo } from "@/lib/format";
import { getViewer } from "@/lib/viewer";

const KIND: Record<string, string> = {
  best_video: "Follow-up", losing_momentum: "Momentum", niche_topics: "Topic", study_videos: "Study", keyword_opportunity: "Keyword",
  upload_timing: "Timing", setup: "Setup", keyword: "Keyword idea", idea: "Idea",
};

export default async function SavedPage() {
  const viewer = await getViewer();
  const ideas = listSaved(viewer);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Saved" subtitle="Feed cards and ideas you chose to keep.">
        {viewer.mode === "demo" ? <SourceBadge source="demo" /> : viewer.channelId ? <SourceBadge source="youtube" /> : null}
      </PageHeader>
      {ideas.length === 0 ? (
        <EmptyState title="Nothing saved yet" body="Press Save on a feed card or a keyword idea and it will wait for you here.">
          <LinkButton href="/feed" variant="primary">Open the feed</LinkButton>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {ideas.map((i) => (
            <Card as="li" key={i.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center gap-2 text-xs text-faint">
                    <Badge>{KIND[i.kind] ?? "Idea"}</Badge> saved {timeAgo(`${i.created_at.replace(" ", "T")}Z`)}
                  </div>
                  <h2 className="text-sm leading-snug font-semibold">{i.title}</h2>
                  {i.body && <p className="mt-1 text-sm leading-relaxed text-muted">{i.body}</p>}
                </div>
                <form action={removeIdeaAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <button className="text-xs text-faint hover:text-text">Remove</button>
                </form>
              </div>
              {i.href && <div className="mt-3"><LinkButton href={i.href} size="sm" icon="arrow">Open</LinkButton></div>}
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
