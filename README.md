# TubeLens

A YouTube growth toolkit modelled on the feature set mapped in [`../vidiq-recon.md`](../vidiq-recon.md).

## Run it

```bash
npm install
cp .env.example .env.local   # optional: add YOUTUBE_API_KEY for live data
npm run dev
```

Open http://localhost:3000. Without an API key every page runs on deterministic demo data.

## Connect YouTube (Google OAuth)

1. In [Google Cloud Console](https://console.cloud.google.com/), create or pick a project and enable **YouTube Data API v3** and **YouTube Analytics API**.
2. **OAuth consent screen**: choose *External*, fill in the app name and your email, and add yourself under **Test users**. While the app is in *Testing*, only test users can sign in, and refresh tokens expire after 7 days.
3. **Credentials → Create credentials → OAuth client ID → Web application**, with the authorized redirect URI `http://localhost:3000/api/auth/callback/google`.
4. Put the client ID and secret in `.env.local`, plus a `SESSION_SECRET` (`openssl rand -base64 32`), then restart `npm run dev`.
5. Click **Connect YouTube** in the sidebar.

Scopes requested: `youtube.readonly` and `yt-analytics.readonly` (read-only; the app can't change your channel). Tokens are stored only in an encrypted, httpOnly cookie. Middleware refreshes the access token before it expires, and **Sign out** revokes it at Google. Publishing beyond test users requires Google's OAuth verification for these sensitive scopes.

## AI Coach (Google Gemini, free tier)

1. Open https://aistudio.google.com/apikey, sign in, and click **Create API key** (pick your TubeLens Google Cloud project).
2. Paste it into `.env.local` as `GEMINI_API_KEY=...` and restart `npm run dev`.

The coach uses `gemini-3.5-flash-lite` by default; set `GEMINI_MODEL=gemini-3.8-flash` for smarter answers (also free). Each question sends the coach your channel stats, recent uploads, outliers and keyword data, and replies stream into the chat. On the free tier Google may use prompts to improve its products, and rate limits apply (see AI Studio → Rate limits). Without a key the coach runs offline, rule-based replies.

## What's here

| Page | Data today | Live with `YOUTUBE_API_KEY` | Live after Connect YouTube |
|---|---|---|---|
| `/feed` | Demo cards + channel stats | — | ✅ your subscribers, views, videos + 28-day change (cards still demo) |
| `/outliers` | Demo corpus | ✅ search → views ÷ channel average | — |
| `/research` | Demo channel directory | ✅ channel search (niche labels still need an LLM step) | — |
| `/keywords` | Demo trends | — (needs a search-volume source) | — |
| `/competitors` | Demo matches | — | — |
| `/optimize` | Demo scores | — | ✅ your recent uploads (scores need a scoring model) |
| `/ai-coach` | Rule-based replies (Gemini with `GEMINI_API_KEY`) | — | ✅ answers from your real stats and uploads |

## Structure

```
src/
  lib/types.ts      Domain types (field names follow the recon's response shapes)
  lib/mock-data.ts  Seeded demo data
  lib/youtube.ts    YouTube Data API v3 client (server-only)
  lib/data.ts       Data layer: live YouTube first, demo fallback
  app/(app)/*       Pages (server components) + sidebar layout
  app/api/*         JSON routes mirroring the recon's endpoint families:
                    creators/feed, youtube/video-outliers, channels/search,
                    xwords/keyword_trends, pyapi/auto_competitors,
                    yt/optimize-videos, quota/balance/global, ai-coach/*
```

## Next steps

1. ~~YouTube OAuth~~ ✅ done (cookie session; move tokens to the database once it exists).
2. Database (Postgres) for channel snapshots, cards, credits and conversations.
3. Nightly job per channel: snapshot stats → find outliers → generate feed cards.
4. ~~LLM-backed coach~~ ✅ Gemini. Next: title scoring and idea generation, charged against a credit balance.
5. Keyword volume source and a crawled video index for Outliers at scale.
