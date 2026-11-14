import { getDb } from "./db";

// Database-backed response cache. Used for public YouTube data so a repeated
// search costs zero quota until it expires.

export interface Cached<T> {
  value: T;
  fetchedAt: string;
  fromCache: boolean;
}

export function peekCache<T>(key: string, now = new Date()): Cached<T> | null {
  const row = getDb().prepare("SELECT payload, fetched_at, expires_at FROM api_cache WHERE key = ?").get(key) as
    | { payload: string; fetched_at: string; expires_at: string }
    | undefined;
  if (!row || row.expires_at <= now.toISOString()) return null;
  return { value: JSON.parse(row.payload) as T, fetchedAt: row.fetched_at, fromCache: true };
}

export function putCache(key: string, value: unknown, ttlSec: number, now = new Date()) {
  getDb()
    .prepare(
      `INSERT INTO api_cache (key, payload, fetched_at, expires_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at`,
    )
    .run(key, JSON.stringify(value), now.toISOString(), new Date(now.getTime() + ttlSec * 1000).toISOString());
}

export async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<Cached<T>> {
  const hit = peekCache<T>(key);
  if (hit) return hit;
  const value = await load();
  const now = new Date();
  putCache(key, value, ttlSec, now);
  return { value, fetchedAt: now.toISOString(), fromCache: false };
}

export function dropCache(prefix: string) {
  getDb().prepare("DELETE FROM api_cache WHERE key LIKE ?").run(`${prefix}%`);
}

export function pruneCache(now = new Date()) {
  getDb().prepare("DELETE FROM api_cache WHERE expires_at <= ?").run(now.toISOString());
}
