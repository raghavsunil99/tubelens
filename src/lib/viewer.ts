import "server-only";

import { cookies } from "next/headers";
import { getSession } from "./auth";
import { getDb } from "./db";
import { ANON_COOKIE, MODE_COOKIE, resolveMode, type Mode } from "./mode";
import type { Session } from "./session";
import { oauthConfigured } from "./session";
import type { YtAuth } from "./youtube/client";

export interface Prefs {
  niche: string | null;
  language: string | null;
  goal: string | null;
  timezone: string | null;
  onboardedAt: string | null;
}

export interface Viewer {
  mode: Mode;
  session: Session | null;
  /** Row key for everything this person saves. Demo and live never share one. */
  userId: string;
  /** The connected channel in live mode; null in demo mode or when disconnected. */
  channelId: string | null;
  prefs: Prefs;
  oauthReady: boolean;
}

const EMPTY_PREFS: Prefs = { niche: null, language: null, goal: null, timezone: null, onboardedAt: null };

export function getPrefs(userId: string): Prefs {
  const row = getDb()
    .prepare("SELECT niche, language, goal, timezone, onboarded_at FROM users WHERE id = ?")
    .get(userId) as { niche: string | null; language: string | null; goal: string | null; timezone: string | null; onboarded_at: string | null } | undefined;
  if (!row) return EMPTY_PREFS;
  return { niche: row.niche, language: row.language, goal: row.goal, timezone: row.timezone, onboardedAt: row.onboarded_at };
}

/** Creates the users row on first write. */
export function ensureUser(userId: string) {
  getDb()
    .prepare("INSERT OR IGNORE INTO users (id, kind) VALUES (?, ?)")
    .run(userId, userId.startsWith("ch:") ? "channel" : "anon");
}

export async function getViewer(): Promise<Viewer> {
  const jar = await cookies();
  const session = await getSession();
  const mode = resolveMode(jar.get(MODE_COOKIE)?.value, Boolean(session?.channel));
  const anon = jar.get(ANON_COOKIE)?.value ?? "local";
  const channelId = mode === "live" ? (session?.channel?.id ?? null) : null;
  const userId = channelId ? `ch:${channelId}` : `anon:${mode}:${anon}`;
  return { mode, session, userId, channelId, prefs: getPrefs(userId), oauthReady: oauthConfigured() };
}

/**
 * Credentials for public YouTube data (search, other channels). Prefers the
 * server's API key; otherwise uses the connected creator's read-only token.
 */
export function publicAuth(viewer: Pick<Viewer, "session">): YtAuth | null {
  if (process.env.YOUTUBE_API_KEY) return { kind: "key", key: process.env.YOUTUBE_API_KEY };
  if (viewer.session) return { kind: "token", token: viewer.session.accessToken };
  return null;
}
