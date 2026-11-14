import "server-only";

import { getDb } from "@/lib/db";
import type { Result } from "@/lib/result";
import { ensureUser, type Viewer } from "@/lib/viewer";
import { DEMO_NICHE } from "@/demo/fixtures";
import { getOverview, type Overview } from "@/features/channel/data";
import { computeMomentum } from "@/features/channel/momentum";
import { peekScan } from "@/features/discovery/scan";
import { listKeywords } from "@/features/keywords/data";
import { buildFeed, type Feed, type FeedCard } from "./build";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export interface FeedView {
  overview: Overview;
  feed: Feed;
  saved: Set<string>;
  niche: string | null;
}

function cardStates(userId: string) {
  const rows = getDb().prepare("SELECT card_key, status FROM alerts WHERE user_id = ?").all(userId) as {
    card_key: string;
    status: "saved" | "dismissed";
  }[];
  return new Map(rows.map((r) => [r.card_key, r.status]));
}

export async function getFeed(viewer: Viewer): Promise<Result<FeedView>> {
  const overview = await getOverview(viewer);
  if (!overview.ok) return overview;
  const niche = viewer.prefs.niche ?? (viewer.mode === "demo" ? DEMO_NICHE : null);
  // Only read a scan that already exists: the feed never spends search quota on its own.
  const scan = niche ? peekScan(viewer, { q: niche, order: "viewCount", days: 90 }) : null;
  const built = buildFeed({
    uploads: overview.data.uploads,
    momentum: computeMomentum(overview.data.snapshots),
    historyDays: overview.data.historyDays,
    niche,
    nicheScan: scan?.value ?? null,
    keywords: listKeywords(viewer),
    timezone: viewer.prefs.timezone ?? DEFAULT_TIMEZONE,
    now: new Date(),
  });
  const states = cardStates(viewer.userId);
  const cards = built.cards.filter((c) => states.get(c.key) !== "dismissed");
  return {
    ...overview,
    data: {
      overview: overview.data,
      feed: { ...built, cards, today: cards[0] ?? null },
      saved: new Set([...states].filter(([, s]) => s === "saved").map(([k]) => k)),
      niche,
    },
  };
}

export function setCardState(viewer: Viewer, card: Pick<FeedCard, "key" | "kind" | "title" | "why"> & { href: string }, status: "saved" | "dismissed" | "none") {
  const db = getDb();
  ensureUser(viewer.userId);
  if (status === "none") {
    db.prepare("DELETE FROM alerts WHERE user_id = ? AND card_key = ?").run(viewer.userId, card.key);
    db.prepare("DELETE FROM saved_ideas WHERE user_id = ? AND ref = ?").run(viewer.userId, card.key);
    return;
  }
  db.prepare(
    `INSERT INTO alerts (user_id, card_key, kind, status) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, card_key) DO UPDATE SET status = excluded.status, updated_at = datetime('now')`,
  ).run(viewer.userId, card.key, card.kind, status);
  if (status === "saved") {
    db.prepare("INSERT OR IGNORE INTO saved_ideas (user_id, ref, kind, title, body, href, source) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      viewer.userId,
      card.key,
      card.kind,
      card.title,
      card.why,
      card.href,
      viewer.mode === "demo" ? "demo" : "youtube",
    );
  } else {
    db.prepare("DELETE FROM saved_ideas WHERE user_id = ? AND ref = ?").run(viewer.userId, card.key);
  }
}

export interface SavedIdea {
  id: number;
  ref: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  created_at: string;
}

export function listSaved(viewer: Viewer): SavedIdea[] {
  return getDb()
    .prepare("SELECT id, ref, kind, title, body, href, created_at FROM saved_ideas WHERE user_id = ? AND source = ? ORDER BY id DESC")
    .all(viewer.userId, viewer.mode === "demo" ? "demo" : "youtube") as unknown as SavedIdea[];
}

export function saveIdea(viewer: Viewer, idea: { ref: string; kind: string; title: string; body?: string; href?: string }) {
  ensureUser(viewer.userId);
  getDb()
    .prepare("INSERT OR IGNORE INTO saved_ideas (user_id, ref, kind, title, body, href, source) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(viewer.userId, idea.ref, idea.kind, idea.title, idea.body ?? null, idea.href ?? null, viewer.mode === "demo" ? "demo" : "youtube");
}

export function removeIdea(viewer: Viewer, id: number) {
  const db = getDb();
  const row = db.prepare("SELECT ref FROM saved_ideas WHERE id = ? AND user_id = ?").get(id, viewer.userId) as { ref: string } | undefined;
  if (!row) return;
  db.prepare("DELETE FROM saved_ideas WHERE id = ?").run(id);
  db.prepare("DELETE FROM alerts WHERE user_id = ? AND card_key = ? AND status = 'saved'").run(viewer.userId, row.ref);
}
