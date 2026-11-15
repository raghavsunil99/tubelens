import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureOAuth, freshDb, jar, mockFetch, rawChannel } from "./helpers";
import { NextRequest } from "next/server";
import { GET as callback } from "@/app/api/auth/callback/google/route";
import { GET as start } from "@/app/api/auth/google/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { buildAuthUrl, GOOGLE_SCOPES } from "@/lib/google-oauth";
import { OAUTH_STATE_COOKIE, sealSession, SESSION_COOKIE, unsealSession, type Session } from "@/lib/session";

const session: Session = {
  accessToken: "ya29.access",
  refreshToken: "1//refresh-token-value",
  expiresAt: Date.now() + 3600_000,
  user: { name: "A" },
  channel: { id: "UC1", title: "C" },
};

const request = (url: string, cookies: Record<string, string> = {}, method = "GET") =>
  new NextRequest(url, { method, headers: { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ") } });

beforeEach(() => {
  configureOAuth();
  freshDb();
  jar.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("scopes", () => {
  it("asks only for read-only access", () => {
    const youtube = GOOGLE_SCOPES.filter((s) => s.startsWith("https://"));
    expect(youtube.length).toBeGreaterThan(0);
    for (const s of youtube) expect(s).toMatch(/\.readonly$/);
    expect(GOOGLE_SCOPES.join(" ")).not.toMatch(/youtube\.upload|youtube\.force-ssl|auth\/youtube(\s|$)|youtubepartner/);
  });
  it("builds a consent URL with state and offline access", () => {
    const url = new URL(buildAuthUrl("abc"));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("state")).toBe("abc");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/callback/google");
  });
});

describe("session cookie", () => {
  it("round-trips and is not readable", async () => {
    const sealed = await sealSession(session);
    expect(sealed).not.toContain("ya29");
    expect(sealed).not.toContain("refresh-token-value");
    expect(await unsealSession(sealed)).toEqual(session);
  });
  it("rejects tampered or foreign cookies", async () => {
    const sealed = await sealSession(session);
    const flipped = sealed.slice(0, -2) + (sealed.endsWith("A") ? "B" : "A") + sealed.slice(-1);
    expect(await unsealSession(flipped)).toBeNull();
    expect(await unsealSession("nonsense")).toBeNull();
    expect(await unsealSession(undefined)).toBeNull();
  });
});

describe("connect flow", () => {
  it("starts by setting a state cookie and redirecting to Google", async () => {
    const res = await start(request("http://localhost:3000/api/auth/google"));
    const location = new URL(res.headers.get("location")!);
    expect(location.host).toBe("accounts.google.com");
    expect(res.cookies.get(OAUTH_STATE_COOKIE)?.value).toBe(location.searchParams.get("state"));
    expect(res.cookies.get(OAUTH_STATE_COOKIE)?.httpOnly).toBe(true);
  });

  it("refuses to start when OAuth isn't configured", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const res = await start(request("http://localhost:3000/api/auth/google"));
    expect(res.headers.get("location")).toContain("auth_error=not_configured");
  });

  it("rejects a callback whose state doesn't match (CSRF)", async () => {
    const calls = mockFetch({});
    const res = await callback(request("http://localhost:3000/api/auth/callback/google?code=x&state=evil", { [OAUTH_STATE_COOKIE]: "good" }));
    expect(res.headers.get("location")).toContain("auth_error=state_mismatch");
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it("reports a cancelled consent screen", async () => {
    const res = await callback(request("http://localhost:3000/api/auth/callback/google?error=access_denied"));
    expect(res.headers.get("location")).toContain("auth_error=access_denied");
  });

  it("refuses a grant without the YouTube read scope", async () => {
    mockFetch({ "oauth2.googleapis.com/token": () => ({ access_token: "ya29.x", expires_in: 3600, scope: "openid email", token_type: "Bearer" }) });
    const res = await callback(request("http://localhost:3000/api/auth/callback/google?code=x&state=s", { [OAUTH_STATE_COOKIE]: "s" }));
    expect(res.headers.get("location")).toContain("auth_error=youtube_scope_denied");
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("stores an encrypted session and sends a new creator to onboarding", async () => {
    mockFetch({
      "oauth2.googleapis.com/token": () => ({
        access_token: "ya29.fresh",
        refresh_token: "1//fresh-refresh",
        expires_in: 3600,
        scope: "openid https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly",
        token_type: "Bearer",
      }),
      "youtube/v3/channels": () => ({ items: [rawChannel()] }),
    });
    const res = await callback(request("http://localhost:3000/api/auth/callback/google?code=x&state=s", { [OAUTH_STATE_COOKIE]: "s" }));
    expect(res.headers.get("location")).toBe("http://localhost:3000/onboarding?step=2");
    const cookie = res.cookies.get(SESSION_COOKIE)!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.value).not.toContain("ya29");
    const stored = await unsealSession(cookie.value);
    expect(stored?.channel).toMatchObject({ id: "UCreal0000000000000000001", title: "Real Channel" });
    expect(stored?.refreshToken).toBe("1//fresh-refresh");
    expect(res.cookies.get("tl_mode")?.value).toBe("live");
  });
});

describe("desktop sign-in handoff", () => {
  const nonce = "a".repeat(64);
  const tokenRoutes = () =>
    mockFetch({
      "oauth2.googleapis.com/token": () => ({ access_token: "ya29.d", refresh_token: "1//d-refresh-token", expires_in: 3600, scope: "openid https://www.googleapis.com/auth/youtube.readonly", token_type: "Bearer" }),
      "youtube/v3/channels": () => ({ items: [rawChannel()] }),
    });

  it("is off by default: the code is ignored and the session goes to the browser", async () => {
    const res = await start(request(`http://localhost:3000/api/auth/google?desktop=${nonce}`));
    expect(res.cookies.get("tl_desktop_nonce")).toBeUndefined();
    const { GET: collect } = await import("@/app/api/auth/desktop/route");
    expect((await collect(new Request(`http://localhost:3000/api/auth/desktop?nonce=${nonce}`))).status).toBe(404);
  });

  describe("in desktop mode", () => {
    beforeEach(() => void (process.env.TUBELENS_DESKTOP = "1"));
    afterEach(() => void delete process.env.TUBELENS_DESKTOP);

    it("rejects malformed codes", async () => {
      const res = await start(request("http://localhost:3000/api/auth/google?desktop=short"));
      expect(res.cookies.get("tl_desktop_nonce")).toBeUndefined();
      const { GET: collect } = await import("@/app/api/auth/desktop/route");
      expect((await collect(new Request("http://localhost:3000/api/auth/desktop?nonce=short"))).status).toBe(400);
    });

    it("parks the session for the app, hands it over once, and never sets a browser cookie", async () => {
      const started = await start(request(`http://localhost:3000/api/auth/google?desktop=${nonce}`));
      expect(started.cookies.get("tl_desktop_nonce")?.value).toBe(nonce);
      tokenRoutes();
      const res = await callback(
        request("http://localhost:3000/api/auth/callback/google?code=x&state=s", { [OAUTH_STATE_COOKIE]: "s", tl_desktop_nonce: nonce }),
      );
      expect(res.headers.get("location")).toBe("http://localhost:3000/desktop-connected");
      expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();

      const { GET: collect } = await import("@/app/api/auth/desktop/route");
      const url = `http://localhost:3000/api/auth/desktop?nonce=${nonce}`;
      const first = await collect(new Request(url));
      expect(first.status).toBe(200);
      const body = await first.json();
      expect(body.next).toBe("/onboarding?step=2");
      expect((await unsealSession(body.session))?.channel?.id).toBe("UCreal0000000000000000001");
      expect((await collect(new Request(url))).status).toBe(204); // one use only
    });

    it("answers 204 for a code nobody has parked, so guessing learns nothing", async () => {
      const { GET: collect } = await import("@/app/api/auth/desktop/route");
      expect((await collect(new Request(`http://localhost:3000/api/auth/desktop?nonce=${"b".repeat(64)}`))).status).toBe(204);
    });

    it("drops the Secure flag on cookies, which would never be sent over http://localhost", async () => {
      const { cookieSecure } = await import("@/lib/desktop");
      const prev = process.env.NODE_ENV;
      vi.stubEnv("NODE_ENV", "production");
      expect(cookieSecure()).toBe(false);
      delete process.env.TUBELENS_DESKTOP;
      expect(cookieSecure()).toBe(true);
      vi.stubEnv("NODE_ENV", prev ?? "test");
    });
  });
});

describe("disconnect", () => {
  it("revokes the refresh token with Google and clears the session", async () => {
    const calls = mockFetch({ "oauth2.googleapis.com/revoke": () => ({}) });
    const res = await logout(request("http://localhost:3000/api/auth/logout", { [SESSION_COOKIE]: await sealSession(session) }, "POST"));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain(encodeURIComponent("1//refresh-token-value"));
    expect(res.status).toBe(303);
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBe("");
  });
});
