import { vi } from "vitest";
import { openDb, setDbForTests } from "@/lib/db";
import { sealSession, SESSION_COOKIE, type Session } from "@/lib/session";

/** A fake cookie jar standing in for next/headers in route and data-layer tests. */
export const jar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

export function freshDb() {
  const db = openDb(":memory:");
  setDbForTests(db);
  return db;
}

export const SECRET = "test-secret-test-secret-test-secret-123";

export function configureOAuth() {
  process.env.SESSION_SECRET = SECRET;
  process.env.GOOGLE_CLIENT_ID = "client-id";
  process.env.GOOGLE_CLIENT_SECRET = "client-secret";
  process.env.APP_URL = "http://localhost:3000";
}

export async function signIn(over: Partial<Session> = {}) {
  const session: Session = {
    accessToken: "ya29.test-access-token",
    refreshToken: "1//test-refresh-token",
    expiresAt: Date.now() + 3600_000,
    user: { name: "Test Creator" },
    channel: { id: "UCreal0000000000000000001", title: "Real Channel" },
    ...over,
  };
  jar.set(SESSION_COOKIE, await sealSession(session));
  return session;
}

type Handler = (url: URL, init?: RequestInit) => unknown | Promise<unknown>;

/** Routes fetch() by URL substring. Unmatched URLs fail the test loudly. */
export function mockFetch(routes: Record<string, Handler | { status: number; body: unknown }>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    calls.push({ url: url.toString(), init });
    for (const [match, route] of Object.entries(routes)) {
      if (!url.toString().includes(match)) continue;
      if (typeof route === "function") return Response.json(await route(url, init));
      return new Response(JSON.stringify(route.body), { status: route.status });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

export const rawChannel = (id = "UCreal0000000000000000001") => ({
  id,
  snippet: { title: "Real Channel", customUrl: "@real", thumbnails: { default: { url: "https://img/c.jpg" } } },
  statistics: { viewCount: "500000", subscriberCount: "4200", videoCount: "40" },
  contentDetails: { relatedPlaylists: { uploads: "UUreal" } },
});

export const rawVideo = (id: string, views: number, daysAgo: number) => ({
  id,
  snippet: {
    title: `Real video ${id}`,
    description: "desc",
    publishedAt: new Date(Date.now() - daysAgo * 86400_000).toISOString(),
    channelId: "UCreal0000000000000000001",
    channelTitle: "Real Channel",
  },
  statistics: { viewCount: String(views), likeCount: "10", commentCount: "2" },
  contentDetails: { duration: "PT8M5S" },
});
