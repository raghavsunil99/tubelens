-- TubeLens initial schema (SQLite).
-- Google tokens are never stored here: they live only in the encrypted,
-- httpOnly session cookie. Everything below is either public YouTube data,
-- the creator's own analytics, or preferences the creator typed in.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,            -- "ch:<channelId>" or "anon:<uuid>"
  kind          TEXT NOT NULL CHECK (kind IN ('channel', 'anon')),
  niche         TEXT,
  language      TEXT,
  goal          TEXT,
  timezone      TEXT,
  onboarded_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE channels (
  id                  TEXT PRIMARY KEY,      -- YouTube channel id
  title               TEXT NOT NULL,
  handle              TEXT,
  thumbnail_url       TEXT,
  country             TEXT,
  uploads_playlist_id TEXT,
  is_demo             INTEGER NOT NULL DEFAULT 0,
  last_synced_at      TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE videos (
  id            TEXT PRIMARY KEY,            -- YouTube video id
  channel_id    TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  tags          TEXT,                        -- JSON array
  published_at  TEXT NOT NULL,
  duration_sec  INTEGER NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  is_demo       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX videos_channel ON videos(channel_id, published_at DESC);

-- One row per channel per day. Lifetime totals come from the Data API on the
-- day of a sync; per-day analytics come from the YouTube Analytics API and are
-- NULL for channels we can only see publicly (e.g. competitors).
CREATE TABLE channel_daily_snapshots (
  channel_id            TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  day                   TEXT NOT NULL,       -- YYYY-MM-DD (UTC)
  subscriber_count      INTEGER,
  view_count            INTEGER,
  video_count           INTEGER,
  views                 INTEGER,
  watch_minutes         INTEGER,
  avg_view_duration_sec INTEGER,
  subs_gained           INTEGER,
  subs_lost             INTEGER,
  likes                 INTEGER,
  comments              INTEGER,
  PRIMARY KEY (channel_id, day)
);

CREATE TABLE video_snapshots (
  video_id      TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  day           TEXT NOT NULL,
  view_count    INTEGER NOT NULL,
  like_count    INTEGER,
  comment_count INTEGER,
  PRIMARY KEY (video_id, day)
);

CREATE TABLE keywords (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phrase          TEXT NOT NULL,
  analysis        TEXT,                      -- JSON KeywordAnalysis from the last scan
  source          TEXT NOT NULL,             -- 'youtube' | 'demo'
  last_scanned_at TEXT,
  UNIQUE (user_id, phrase)
);

CREATE TABLE competitors (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  added_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, channel_id)
);

CREATE TABLE saved_ideas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ref        TEXT NOT NULL,                  -- stable key so saving twice is a no-op
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  href       TEXT,
  source     TEXT NOT NULL,                  -- 'youtube' | 'demo'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, ref)
);

-- Feed cards the creator has acted on (saved or dismissed).
CREATE TABLE alerts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_key   TEXT NOT NULL,
  kind       TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('saved', 'dismissed')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, card_key)
);

CREATE TABLE ai_conversations (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  source     TEXT NOT NULL,                  -- data the answers were grounded in
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ai_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cached API responses, so repeat visits don't spend YouTube quota.
CREATE TABLE api_cache (
  key        TEXT PRIMARY KEY,
  payload    TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- TubeLens's own estimate of YouTube Data API units spent per Pacific day.
CREATE TABLE quota_usage (
  day       TEXT PRIMARY KEY,
  units     INTEGER NOT NULL DEFAULT 0,
  exhausted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE audit_log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     TEXT NOT NULL DEFAULT (datetime('now')),
  level  TEXT NOT NULL,
  event  TEXT NOT NULL,
  detail TEXT
);
