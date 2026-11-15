"use client";

import { useState } from "react";
import { Panel, Thumb } from "@/components/ui";
import { compact, scoreColor, timeAgo } from "@/lib/format";
import type { OptimizeVideo } from "@/lib/types";

interface AiScore {
  score: number;
  tip: string;
}

function average(values: (number | null)[]) {
  const nums = values.filter((v): v is number => v !== null);
  return nums.length ? Math.round(nums.reduce((s, v) => s + v, 0) / nums.length) : null;
}

export function OptimizeList({ videos, live }: { videos: OptimizeVideo[]; live: boolean }) {
  // AI scores by video id. They replace any demo/placeholder title score.
  const [ai, setAi] = useState<Record<string, AiScore>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const batch = videos.slice(0, 20);
  const scored = batch.filter((v) => ai[v.id]).length;
  const titleScoreOf = (v: OptimizeVideo) => (ai[v.id] ? ai[v.id].score : live ? null : v.titleScore);
  const avgTitle = average(videos.map(titleScoreOf));
  const avgThumb = average(videos.map((v) => (live ? null : v.thumbnailScore)));

  async function scoreAll() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/yt/score-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles: batch.map((v) => v.title) }),
      });
      const body = (await res.json()) as { scores?: { score: number; tip: string }[]; error?: string };
      if (!res.ok || !body.scores) throw new Error(body.error ?? `Request failed (${res.status})`);
      const next: Record<string, AiScore> = {};
      batch.forEach((v, i) => {
        const s = body.scores![i];
        if (s) next[v.id] = { score: s.score, tip: s.tip };
      });
      setAi(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Panel className="p-4">
          <div className="text-xs text-muted">Average title score</div>
          <div className={`mt-1 text-2xl font-semibold ${scoreColor(avgTitle)}`}>{avgTitle ?? "—"}</div>
          <div className="mt-1 text-[11px] text-muted">
            {scored ? "AI estimate" : live ? "Not scored yet" : "Demo data"}
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="text-xs text-muted">Average thumbnail score</div>
          <div className={`mt-1 text-2xl font-semibold ${scoreColor(avgThumb)}`}>{avgThumb ?? "—"}</div>
          <div className="mt-1 text-[11px] text-muted">{live ? "Not available yet" : "Demo data"}</div>
        </Panel>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={scoreAll}
          disabled={busy || batch.length === 0}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Scoring…" : scored ? "Re-score titles" : `Score ${batch.length} titles with AI`}
        </button>
        <span className="text-xs text-muted">
          Scores are an AI judgement of the title text (curiosity, clarity, keyword, length), not a YouTube metric.
        </span>
      </div>
      {error && (
        <div className="mb-4 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">{error}</div>
      )}

      {videos.length === 0 ? (
        <Panel className="p-8 text-center text-muted">No uploads found on this channel yet.</Panel>
      ) : (
        <Panel>
          {videos.map((v) => {
            const titleScore = titleScoreOf(v);
            const tip = ai[v.id]?.tip;
            return (
              <a
                key={v.id}
                href={live ? `https://www.youtube.com/watch?v=${v.id}` : undefined}
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
                  {tip && <div className="mt-1.5 text-xs text-accent">💡 {tip}</div>}
                </div>
                {titleScore === null ? (
                  <span className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs text-muted">Not scored yet</span>
                ) : (
                  <div className="flex gap-5 text-center">
                    <div>
                      <div className={`text-lg font-semibold ${scoreColor(titleScore)}`}>{titleScore}</div>
                      <div className="text-[11px] text-muted">Title</div>
                    </div>
                    <div>
                      <div className={`text-lg font-semibold ${scoreColor(live ? null : v.thumbnailScore)}`}>
                        {live ? "—" : (v.thumbnailScore ?? "—")}
                      </div>
                      <div className="text-[11px] text-muted">Thumb</div>
                    </div>
                  </div>
                )}
              </a>
            );
          })}
        </Panel>
      )}
    </>
  );
}
