import type { Result } from "@/lib/result";

const STATUS = { disconnected: 401, no_channel: 409, not_configured: 503, quota: 429, rate_limited: 429, auth: 401, not_found: 404, error: 502 } as const;

export function statusFor(result: Result<unknown>) {
  return result.ok ? 200 : STATUS[result.problem.kind];
}
