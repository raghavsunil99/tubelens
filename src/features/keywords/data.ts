import "server-only";

import { getDb } from "@/lib/db";
import type { DataSource, Result } from "@/lib/result";
import { ensureUser, type Viewer } from "@/lib/viewer";
import { DEMO_KEYWORDS, demoScan } from "@/demo/fixtures";
import { scanTopic } from "@/features/discovery/scan";
import { analyzeKeyword, type KeywordAnalysis } from "./score";

export interface KeywordResult {
  analysis: KeywordAnalysis;
  /** A few of the videos that rank, so the creator can check the read for themselves. */
  topResults: { id: string; title: string; channelTitle: string; views: number; subscribers: number | null }[];
  note?: string;
}

function remember(viewer: Viewer, analysis: KeywordAnalysis, source: DataSource) {
  ensureUser(viewer.userId);
  getDb()
    .prepare(
      `INSERT INTO keywords (user_id, phrase, analysis, source, last_scanned_at) VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, phrase) DO UPDATE SET analysis = excluded.analysis, source = excluded.source, last_scanned_at = excluded.last_scanned_at`,
    )
    .run(viewer.userId, analysis.phrase.toLowerCase(), JSON.stringify(analysis), source);
}

export async function getKeyword(viewer: Viewer, phrase: string, language?: string): Promise<Result<KeywordResult>> {
  const scan = await scanTopic(viewer, { q: phrase, order: "relevance", language });
  if (!scan.ok) return scan;
  const analysis = analyzeKeyword(phrase, scan.data.videos);
  remember(viewer, analysis, scan.source);
  return {
    ...scan,
    data: {
      analysis,
      topResults: scan.data.videos.slice(0, 6).map((v) => ({
        id: v.id,
        title: v.title,
        channelTitle: v.channelTitle,
        views: v.views,
        subscribers: v.channel.subscribers,
      })),
      note: scan.data.note,
    },
  };
}

/** Keywords this creator has already analysed, newest first. In demo mode, a few examples are included. */
export function listKeywords(viewer: Viewer): KeywordAnalysis[] {
  const rows = getDb()
    .prepare("SELECT analysis FROM keywords WHERE user_id = ? AND source = ? ORDER BY last_scanned_at DESC LIMIT 30")
    .all(viewer.userId, viewer.mode === "demo" ? "demo" : "youtube") as { analysis: string }[];
  const saved = rows.map((r) => JSON.parse(r.analysis) as KeywordAnalysis);
  if (viewer.mode !== "demo") return saved;
  const have = new Set(saved.map((k) => k.phrase.toLowerCase()));
  const all = demoScan();
  return [...saved, ...DEMO_KEYWORDS.filter((k) => !have.has(k)).map((k) => analyzeKeyword(k, all))];
}

export function forgetKeyword(viewer: Viewer, phrase: string) {
  getDb().prepare("DELETE FROM keywords WHERE user_id = ? AND phrase = ?").run(viewer.userId, phrase.toLowerCase());
}
