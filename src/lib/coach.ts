import "server-only";

// AI Coach: builds a channel-data context and streams answers from Google
// Gemini (free tier). Falls back to simple rule-based replies when
// GEMINI_API_KEY isn't set, so the page still works without a key.
import { FinishReason, GoogleGenAI, type Content } from "@google/genai";
import { getChannelStats, getKeywordTrends, getOptimizeVideos, getOutliers } from "./data";
import type { Session } from "./session";
import type { ChatMessage } from "./types";

// Google's docs recommend 3.5 Flash-Lite or 3.8 Flash for new projects; both
// have a free tier. Override with GEMINI_MODEL in .env.local.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 4000;

export function geminiEnabled() {
  return Boolean(process.env.GEMINI_API_KEY);
}

let client: GoogleGenAI | null = null;
function gemini() {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

/** Keeps only well-formed recent turns, trimmed, starting with a user turn. */
export function sanitizeHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const msgs = raw
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
    .slice(-MAX_HISTORY);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}

/** Plain-text snapshot of everything the coach should know about this creator. */
async function buildContext(session: Session | null) {
  const [stats, uploads, outliers, keywords] = await Promise.all([
    getChannelStats(session),
    getOptimizeVideos(session),
    getOutliers({ minScore: 3 }),
    getKeywordTrends(),
  ]);
  const s = stats.data;
  const lines: string[] = [];

  if (stats.source === "youtube") {
    lines.push(`CHANNEL (real data from YouTube): ${session?.channel?.title ?? "the user's channel"}`);
  } else {
    lines.push("CHANNEL: the user has not connected YouTube. The numbers below are DEMO data; say so if you use them.");
  }
  lines.push(
    `- Subscribers: ${s.current.subscriberCount} (change over last period: ${s.current.subscriberCount - s.previous.subscriberCount})`,
    `- Total views: ${s.current.viewCount} (change: ${s.current.viewCount - s.previous.viewCount})`,
    `- Videos: ${s.current.videoCount} (new this period: ${s.current.videoCount - s.previous.videoCount})`,
    "",
    `RECENT UPLOADS (${uploads.source === "youtube" ? "real" : "demo"}), newest first:`,
    ...uploads.data
      .slice(0, 15)
      .map((v) => `- "${v.title}" | ${v.viewCount} views | ${v.videoType} | published ${v.publishedAt.slice(0, 10)}`),
    "",
    `OUTLIER VIDEOS IN THE WIDER NICHE (${outliers.source === "youtube" ? "real" : "demo"}): views divided by that channel's average`,
    ...outliers.data
      .slice(0, 8)
      .map((o) => `- "${o.video_title}" by ${o.channel_title}: ${o.outlier_score}x average`),
    "",
    "KEYWORD OPPORTUNITIES (demo data; volume and competition are 0-100 scores):",
    ...keywords
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 8)
      .map((k) => `- ${k.keyword}: overall ${k.overall}, volume ${k.volume}, competition ${k.competition}, 7-day change ${k.period_percent_change}%`),
  );
  return lines.join("\n");
}

const SYSTEM = `You are TubeLens Coach, a friendly, practical YouTube growth coach.

How to answer:
- Ground every claim about the user's channel in the CHANNEL DATA below. Quote real numbers and real video titles. Never invent statistics or titles.
- If the data says DEMO, tell the user these are sample numbers and suggest clicking "Connect YouTube" in the sidebar.
- If the data can't answer the question (e.g. watch time, retention, CTR), say what's missing instead of guessing.
- Give specific, actionable steps: concrete title ideas, formats, upload timing, thumbnail tips.
- Keep answers short: a few bullet points or a short list, under about 200 words unless asked for more.
- Reply in the user's language and style. If they write Telugu in English letters (Tenglish), reply the same way.`;

/**
 * Streams the coach's reply as plain text chunks. Throws on API errors so the
 * caller can show a message.
 */
export async function* streamCoachReply(history: ChatMessage[], session: Session | null) {
  if (!geminiEnabled()) {
    yield await ruleBasedReply(history, session);
    return;
  }

  const context = await buildContext(session);
  const contents: Content[] = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const stream = await gemini().models.generateContentStream({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: `${SYSTEM}\n\nCHANNEL DATA\n${context}`,
      maxOutputTokens: 2048,
    },
  });

  let finish: FinishReason | undefined;
  let blocked = false;
  for await (const chunk of stream) {
    if (chunk.promptFeedback?.blockReason) blocked = true;
    finish = chunk.candidates?.[0]?.finishReason ?? finish;
    const text = chunk.text;
    if (text) yield text;
  }

  if (blocked || (finish && finish !== FinishReason.STOP && finish !== FinishReason.MAX_TOKENS)) {
    yield "\n\n(Gemini stopped this answer because of its safety filters. Try rephrasing the question.)";
  } else if (finish === FinishReason.MAX_TOKENS) {
    yield "\n\n(Answer cut short. Ask me to continue.)";
  }
}

/** Offline fallback used when no GEMINI_API_KEY is configured. */
async function ruleBasedReply(history: ChatMessage[], session: Session | null) {
  const last = history.at(-1)?.content.toLowerCase() ?? "";
  const { data: stats } = await getChannelStats(session);
  const subDelta = stats.current.subscriberCount - stats.previous.subscriberCount;
  const note = "\n\n(Offline mode: add GEMINI_API_KEY to .env.local for real AI answers.)";

  if (/audit|how am i|doing/.test(last)) {
    return (
      `Quick audit: ${stats.current.subscriberCount.toLocaleString()} subscribers ` +
      `(${subDelta >= 0 ? "+" : ""}${subDelta.toLocaleString()} this period) across ${stats.current.videoCount} videos.\n\n` +
      `1. Check your lowest-viewed recent titles on the Optimize page.\n` +
      `2. Upload on the same weekday each week.\n` +
      `3. Study the Outliers page for formats that are working now.` +
      note
    );
  }
  if (/idea|what should i make|topic/.test(last)) {
    const { data } = await getOutliers({ minScore: 5 });
    return (
      "These videos are breaking out right now. Each is a format you could adapt:\n\n" +
      data
        .slice(0, 3)
        .map((o) => `• “${o.video_title}”: ${o.outlier_score}x its channel average`)
        .join("\n") +
      note
    );
  }
  if (/keyword|seo|search/.test(last)) {
    const kws = (await getKeywordTrends()).sort((a, b) => b.overall - a.overall).slice(0, 3);
    return (
      "Best keyword opportunities this week (high volume, low competition):\n\n" +
      kws.map((k) => `• ${k.keyword}: score ${k.overall}/100`).join("\n") +
      note
    );
  }
  return "I can audit your channel, suggest video ideas from current outliers, or find keyword opportunities. Which would help most?" + note;
}
