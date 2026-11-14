// Every data function returns a Result, so a page always knows whether it is
// showing live YouTube data, demo fixtures, or nothing at all (and why).
// There is deliberately no "fall back to demo numbers on error" path.

export type DataSource = "youtube" | "demo";

export type ProblemKind =
  | "disconnected" // live mode, but no YouTube account is connected
  | "no_channel" // signed in, but the Google account has no channel
  | "not_configured" // server is missing the env vars this feature needs
  | "quota" // YouTube daily quota is used up
  | "rate_limited"
  | "auth" // Google rejected the credentials
  | "not_found"
  | "error";

export interface Problem {
  kind: ProblemKind;
  message: string;
}

export type Result<T> =
  | { ok: true; source: DataSource; data: T; fetchedAt?: string; fromCache?: boolean }
  | { ok: false; problem: Problem };

export const ok = <T>(source: DataSource, data: T, meta?: { fetchedAt?: string; fromCache?: boolean }): Result<T> => ({
  ok: true,
  source,
  data,
  ...meta,
});

export const fail = (kind: ProblemKind, message: string): Result<never> => ({ ok: false, problem: { kind, message } });

export type Confidence = "high" | "medium" | "low";
