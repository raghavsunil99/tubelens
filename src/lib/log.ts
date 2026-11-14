import "server-only";

import { getDb } from "./db";
import { redact } from "./redact";

type Level = "info" | "warn" | "error";

/**
 * Audit-friendly log: one redacted line on the console and one row in
 * audit_log. `event` is a stable name ("youtube.quota_exceeded"); `detail` is
 * free-form and is redacted before it is written anywhere.
 */
export function logEvent(level: Level, event: string, detail?: unknown) {
  const safe = detail === undefined ? undefined : redact(detail);
  const line = `[tubelens] ${event}${safe ? ` ${safe}` : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
  try {
    getDb().prepare("INSERT INTO audit_log (level, event, detail) VALUES (?, ?, ?)").run(level, event, safe ?? null);
  } catch {
    // Logging must never break a request.
  }
}

export function recentEvents(limit = 20) {
  return getDb()
    .prepare("SELECT at, level, event, detail FROM audit_log ORDER BY id DESC LIMIT ?")
    .all(limit) as { at: string; level: Level; event: string; detail: string | null }[];
}
