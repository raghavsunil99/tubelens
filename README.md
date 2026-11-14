<p align="center">
  <img src="docs/images/hero.png" alt="TubeLens by Raghav: grow your YouTube channel with data, not guesses" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=fff&style=for-the-badge" alt="Next.js 15">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=fff&style=for-the-badge" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=fff&style=for-the-badge" alt="Tailwind CSS 4">
  <img src="https://img.shields.io/badge/YouTube_API-v3-FF0033?logo=youtube&logoColor=fff&style=for-the-badge" alt="YouTube Data API v3">
  <img src="https://img.shields.io/badge/AI_Coach-Gemini-8E75FF?logo=googlegemini&logoColor=fff&style=for-the-badge" alt="Gemini AI Coach">
</p>

<p align="center">
  <b>TubeLens shows you what's working on YouTube right now, and what to make next.</b><br>
  Find breakout videos in your niche, research channels and keywords, and ask an AI coach that knows your real channel numbers.
</p>

<p align="center">
  <a href="#-features">Features</a> ·
  <a href="#-quick-start">Quick start</a> ·
  <a href="#-connect-your-accounts">Connect your accounts</a> ·
  <a href="#-how-it-works">How it works</a> ·
  <a href="#-roadmap">Roadmap</a> ·
  <a href="#-questions">Questions</a>
</p>

<p align="center">
  <img src="docs/images/feed.png" alt="The TubeLens feed: channel stats, video ideas, outlier alerts, the best time to publish and trending keywords" width="100%">
</p>

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### ⚡ Outliers
Videos getting **far more views than their channel normally does**: 14x, 20x, 25x their average. Search any topic, filter long-form or Shorts, and see exactly which formats are breaking out.

</td>
<td width="50%" valign="top">

### ✦ AI Coach
Ask anything about growing your channel. The coach reads your **real subscribers, views and latest uploads**, and answers with specific ideas. It even replies in Tenglish if you write in Tenglish.

</td>
</tr>
<tr>
<td><img src="docs/images/outliers.png" alt="Outliers: breakout videos with their outlier score, views versus channel average, and duration"></td>
<td><img src="docs/images/coach.png" alt="The AI Coach suggesting video ideas from channel data and keyword opportunities"></td>
</tr>
<tr>
<td width="50%" valign="top">

### ↗ Optimize
Your recent uploads in one list with **title and thumbnail scores**, so you know which videos to fix first. Connect YouTube and it lists your real videos and views (scores for real videos are on the [roadmap](#-roadmap)).

</td>
<td width="50%" valign="top">

### ⌕ Channel research
Find channels by niche, size and estimated earnings. Spot **faceless** and **podcast** channels to study or partner with.

</td>
</tr>
<tr>
<td><img src="docs/images/optimize.png" alt="Optimize: recent uploads with title and thumbnail scores"></td>
<td><img src="docs/images/research.png" alt="Channel research: channels with niche, subscribers, average views, video count and estimated earnings"></td>
</tr>
<tr>
<td width="50%" valign="top">

### # Keyword research
Search volume, competition and 7-day trend for each keyword, rolled into one **overall score**: high volume and low competition score highest.

</td>
<td width="50%" valign="top">

### ⚔ Competitors
Channels in your niche, matched by topic, language and audience size, with a match score.

</td>
</tr>
<tr>
<td><img src="docs/images/keywords.png" alt="Keyword research: volume, competition, estimated monthly searches, trend and overall score"></td>
<td><img src="docs/images/competitors.png" alt="Competitors: matched channels with subscriber counts and match percentage"></td>
</tr>
</table>

<table>
<tr>
<td width="30%"><img src="docs/images/mobile.png" alt="TubeLens on a phone"></td>
<td valign="middle">

### 📱 Works on your phone
The whole app adapts to small screens: the sidebar becomes a scrollable top bar, and cards stack into one column.

### ▶ Your own channel, read-only
**Connect YouTube** signs in with Google and reads your channel with read-only access. TubeLens can never post, edit or delete anything. Sign out at any time, and access is revoked at Google too.

</td>
</tr>
</table>

## 🚀 Quick start

You need **Node.js 22 or later**.

```bash
git clone https://github.com/raghavsunil99/tubelens.git
cd tubelens
npm install
npm run dev
```

Open **http://localhost:3000**. Every page works right away on built-in demo data; no keys needed.

To use real data, copy the example settings file and fill in the keys you want (each one is optional):

```bash
cp .env.example .env.local
```

## 🔑 Connect your accounts

| Key in `.env.local` | Turns on | Cost |
|---|---|---|
| `GEMINI_API_KEY` | Real AI Coach answers (Google Gemini) | Free tier |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` | **Connect YouTube**: your real stats in Feed, Optimize and the Coach | Free |
| `YOUTUBE_API_KEY` | Live YouTube search in Outliers and Channel research | Free (daily quota) |

Restart `npm run dev` after changing `.env.local`.

<details>
<summary><b>🤖 AI Coach: get a free Gemini key</b></summary>

1. Open [Google AI Studio → API keys](https://aistudio.google.com/apikey) and click **Create API key**.
2. Add it to `.env.local`:
   ```
   GEMINI_API_KEY=your-key
   ```
3. Optional: `GEMINI_MODEL=gemini-3.8-flash` for smarter answers (the default is `gemini-3.5-flash-lite`; both have a free tier).

On the free tier, Google may use prompts to improve its products, and rate limits apply. Without a key the coach gives simple offline answers.

</details>

<details>
<summary><b>▶ Connect YouTube: Google sign-in</b></summary>

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable **YouTube Data API v3** and **YouTube Analytics API**.
2. Under **Google Auth Platform**, set up the consent screen (External), and add your Gmail under **Audience → Test users**.
3. **Clients → Create client → Web application**, with this authorized redirect URI:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
4. Add the client ID and secret to `.env.local`, plus a random session secret:
   ```bash
   openssl rand -base64 32
   ```
   ```
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   SESSION_SECRET=paste-the-random-value
   ```
5. Click **Connect YouTube** in the sidebar.

While the app is in *Testing* mode, only test users can sign in and logins expire after 7 days. Publishing to everyone requires Google's app verification.

</details>

<details>
<summary><b>🔎 Live search: YouTube Data API key</b></summary>

1. In the same Google Cloud project: **APIs & Services → Credentials → Create credentials → API key**.
2. Add it to `.env.local`:
   ```
   YOUTUBE_API_KEY=your-key
   ```

Each search uses about 100 units of the free 10,000-unit daily quota.

</details>

## 🧠 How it works

> The screenshots above predate the current interface and will be refreshed.

**Demo and live never mix.** The Demo switch in the sidebar decides where numbers come from. In Demo mode everything is read from `src/demo/fixtures.ts` and labelled "Demo data". In live mode everything comes from YouTube; if something can't be fetched the page says why. It never falls back to demo numbers.

**Every number is explainable.** Scores are plain arithmetic on values YouTube returned, each screen has a "how this is worked out" note, and anything YouTube doesn't publish (search volume, earnings, click-through rate) is not shown at all.

```
src/
  app/                  routes: (app)/feed, outliers, keywords, optimize, competitors, research, ai-coach, saved, settings; onboarding; api/
  features/             one folder per feature: pure scoring (score.ts, build.ts, metrics.ts) + data layer (data.ts)
    channel/            overview, history store, momentum, scheduled sync
    discovery/          cached "topic scan" shared by Outliers, Keywords and the Feed
    feed/ outliers/ keywords/ optimize/ competitors/ coach/ onboarding/
  demo/                 demo fixtures and seed (the only made-up data in the repo)
  lib/                  session + OAuth, YouTube client, db, cache, quota ledger, redacted logging, demo/live mode
  components/ui/        design system: cards, badges, buttons, states, chart
db/migrations/          plain SQL migrations, applied automatically on first run
tests/                  Vitest: scoring, OAuth, API routes, demo/live switching, database
```

**Database.** SQLite through Node's built-in `node:sqlite` (Node 22.13+), so there is nothing to install or run. Tables: `users`, `channels`, `videos`, `channel_daily_snapshots`, `video_snapshots`, `keywords`, `competitors`, `saved_ideas`, `alerts`, `ai_conversations`, `ai_messages`, plus `api_cache`, `quota_usage` and `audit_log`. Google tokens are never stored there: they stay in the encrypted, httpOnly session cookie.

**Quota.** A new search costs about 100 of the 10,000 daily YouTube units and is cached for 24 hours; opening your own channel costs about 3 and is cached for 15 minutes. TubeLens keeps its own usage estimate, warns at 80% and pauses new searches before the limit.

**Commands**

```bash
npm install
npm run dev          # http://localhost:3000 (starts in Demo mode with no keys)
npm test             # scoring, OAuth, API routes, demo/live switching
npm run db:migrate   # optional: migrations also run on first start
npm run db:seed      # optional: load the demo fixtures into the database
```

## 🗺 Roadmap

- Median-of-recent-uploads baseline for outlier scores (currently the channel's lifetime average)
- Postgres or Turso adapter for serverless hosting (SQLite needs a persistent disk)
- Background analytics sync with encrypted refresh tokens, for watch-time history between visits
- Thumbnail analysis with a vision model, clearly labelled as AI opinion
- Weekly email or WhatsApp summary of feed cards

## ❓ Questions

**Do I need any keys to try it?**
No. Every page runs on demo data out of the box; a "Demo data" badge shows where.

**Is it free?**
Yes. The Gemini free tier, Google sign-in and the YouTube API daily quota are all free.

**"Google hasn't verified this app" when connecting YouTube.**
That's expected for your own test app. Click **Continue**. Only Gmail accounts you added as test users can sign in.

**The coach says the free Gemini quota is used up.**
Free-tier limits reset over time; wait a minute (or until the next day for the daily limit). You can see your limits in AI Studio under **Rate limits**.

**Can TubeLens change my YouTube channel?**
No. It only asks for read-only access.

---

<p align="center">
  Built by <b>Raghav</b> · An independent project, not affiliated with YouTube, Google or vidIQ.
</p>
