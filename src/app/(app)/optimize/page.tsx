import { PageHeader, SourceBadge } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getOptimizeVideos } from "@/lib/data";
import { OptimizeList } from "./OptimizeList";

export default async function OptimizePage() {
  const session = await getSession();
  const { source, data: videos } = await getOptimizeVideos(session);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Optimize" subtitle="Score your recent titles with AI and fix the weakest first.">
        <SourceBadge source={source} />
      </PageHeader>
      <OptimizeList videos={videos} live={source === "youtube"} />
    </div>
  );
}
