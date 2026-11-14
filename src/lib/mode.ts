// Demo vs live. Pure, so middleware, tests and server code can all use it.
//
// - "demo": every number comes from src/demo fixtures and is labelled as such.
// - "live": every number comes from YouTube. If something can't be fetched the
//   page says so; it never quietly substitutes demo numbers.

export type Mode = "demo" | "live";

export const MODE_COOKIE = "tl_mode";
export const ANON_COOKIE = "tl_anon";

/**
 * An explicit choice (the Demo switch) wins. With no choice yet, a connected
 * channel means live and anything else starts in demo.
 */
export function resolveMode(cookie: string | undefined, hasChannel: boolean): Mode {
  if (cookie === "demo" || cookie === "live") return cookie;
  return hasChannel ? "live" : "demo";
}
