import "server-only";

// AI Coach. Builds a labelled evidence pack from the creator's data, then asks
// Gemini to answer using only that pack and to cite the sections it used.
// Without GEMINI_API_KEY it falls back to short rule-based answers from the
// same evidence, so the page still works.
import { FinishReason, GoogleGenAI, type Content } from "@google/genai";
import { getDb } from "@/lib/db";
import { compact } from "@/lib/format";
import type { DataSource } from "@/lib/result";
import { ensureUser, type Viewer } from "@/lib/viewer";
import { isShort } from "@/lib/youtube/types";
import { getOverview } from "@/features/channel/data";
import { getCompetitors } from "@/features/competitors/data";
import { getFeed } from "@/features/feed/data";
import { languageName } from "@/features/onboarding/options";
import { reviewVideo } from "@/features/optimize/score";
import { median } from "@/lib/text";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 4000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const QUICK_PROMPTS = [
  "What should I upload next?",
  "Why did my last video underperform?",
  "Find content gaps in my niche.",
  "Give me 10 Telugu video ideas.",
  "Compare me with my competitors.",
  "Improve this title and thumbnail concept.",
];

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
        !!m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
    .slice(-MAX_HISTORY);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}

export interface Evidence {
  /** The labelled text handed to the model. */
  text: string;
  /** Section names present, shown to the creator as "data used". */
  sections: string[];
  /** Where the channel numbers came from; null when none could be loaded. */
  source: DataSource | null;
}

/** Everything the coach is allowed to know about this creator, as labelled sections. */
export async function buildEvidence(viewer: Viewer): Promise<Evidence> {
  const parts: string[] = [];
  const sections: string[] = [];
  const add = (name: string, lines: string[]) => {
    if (lines.length === 0) return;
    sections.push(name);
    parts.push(`[${name}]\n${lines.join("\n")}`);
  };

  const p = viewer.prefs;
  add("PREFERENCES", [
    p.niche ? `Niche: ${p.niche}` : "",
    p.language ? `Channel language: ${languageName(p.language) ?? p.language}` : "",
    p.goal ? `Goal: ${p.goal}` : "",
  ].filter(Boolean));

  const overview = await getOverview(viewer);
  if (!overview.ok) {
    return {
      text: `NO CHANNEL DATA IS AVAILABLE. Reason: ${overview.problem.message}\n\n${parts.join("\n\n")}`,
      sections,
      source: null,
    };
  }
  const { channel, uploads, history, hasAnalytics, videoAnalytics } = overview.data;
  const demoNote = overview.source === "demo" ? " (DEMO DATA: made-up examples, not the user's real channel)" : " (real data from YouTube)";

  add("CHANNEL", [
    `Name: ${channel.title}${demoNote}`,
    `Subscribers: ${channel.subscribers ?? "hidden"}`,
    `Total views: ${channel.totalViews}`,
    `Total videos: ${channel.videoCount}`,
  ]);

  if (hasAnalytics) {
    const days = history.filter((d) => d.views !== null);
    const sum = (f: (d: (typeof days)[number]) => number | null) => days.reduce((s, d) => s + (f(d) ?? 0), 0);
    add("LAST 28 DAYS", [
      `Views: ${sum((d) => d.views)}`,
      `Watch time: ${Math.round(sum((d) => d.watchMinutes) / 60)} hours`,
      `Net subscribers: ${sum((d) => d.subsNet)}`,
      "Source: YouTube Analytics (can lag 2-3 days)",
    ]);
  }

  const typicalLong = median(uploads.filter((v) => !isShort(v)).map((v) => v.views));
  add("UPLOADS", [
    typicalLong !== null ? `Typical (median) views for a long-form video: ${Math.round(typicalLong)}` : "",
    ...uploads.slice(0, 15).map((v) => {
      const a = videoAnalytics?.find((x) => x.videoId === v.id);
      return `- "${v.title}" | ${v.views} views | ${v.likes ?? "?"} likes | ${isShort(v) ? "Short" : `${Math.round(v.durationSec / 60)} min`} | published ${v.publishedAt.slice(0, 10)}${a ? ` | avg ${Math.round(a.avgViewPercent)}% watched` : ""}`;
    }),
  ].filter(Boolean));

  if (uploads[0]) {
    const r = reviewVideo(uploads[0], { analytics: videoAnalytics?.find((x) => x.videoId === uploads[0].id) });
    add("LATEST VIDEO REVIEW", [
      `Video: "${uploads[0].title}"`,
      typicalLong !== null && !isShort(uploads[0])
        ? `Views so far: ${uploads[0].views}, which is ${(uploads[0].views / typicalLong).toFixed(1)}x your typical long-form video (${Math.round(typicalLong)}). It was published ${uploads[0].publishedAt.slice(0, 10)}, so it may still be collecting views.`
        : `Views so far: ${uploads[0].views}.`,
      `Title clarity: ${r.titleClarity.band ?? "not assessed"}; topic relevance: ${r.topicRelevance.band ?? "not assessed"}; hook: ${r.hook.band ?? "not assessed"}`,
      ...r.suggestions.slice(0, 5).map((s) => `- ${s}`),
    ]);
  }

  const feed = await getFeed(viewer);
  if (feed.ok) {
    add("FEED CARDS", feed.data.feed.cards.filter((c) => c.kind !== "setup").map((c) => `- ${c.label}: ${c.title}. ${c.evidence.map((e) => `${e.label}: ${e.value}`).join("; ")} (confidence: ${c.confidence})`));
  }

  const comps = await getCompetitors(viewer);
  if (comps.ok && comps.data.competitors.length > 0) {
    add("COMPETITORS", [
      ...comps.data.competitors.map((c) => `- ${c.channel.title}: ${c.channel.subscribers ?? "hidden"} subscribers, ${c.summary.uploadsPerWeek ?? "?"} uploads/week, typical views ${c.summary.medianViews === null ? "?" : compact(c.summary.medianViews)}, top video "${c.summary.topVideos[0]?.title ?? "n/a"}"`),
      ...comps.data.gaps.map((g) => `- Gap topic "${g.topic}": e.g. "${g.examples[0].title}" (${g.examples[0].channelTitle}, ${g.examples[0].views} views)`),
    ]);
  }

  return { text: parts.join("\n\n"), sections, source: overview.source };
}

export const SYSTEM = `You are TubeLens Coach, a practical YouTube growth coach for Indian and global creators.

You are given a DATA PACK made of labelled sections such as [CHANNEL] or [UPLOADS]. It is the only information you have about this creator.

Rules, in priority order:
1. Never invent numbers, video titles, or facts about the channel. Use only what is in the DATA PACK.
2. You do NOT have: click-through rate, impressions, revenue, audience age/gender/location, traffic sources, or search volume. If asked, say plainly that TubeLens doesn't have that data and where to find it (YouTube Studio).
3. If a section says DEMO DATA, say once, at the start, that these are example numbers and not the creator's real channel.
4. If the DATA PACK says no channel data is available, say so, and give general advice clearly marked as general.
5. When you go beyond the data, start the sentence with "Assumption:".

Format every answer with these four bold headings, in this order:
**Diagnosis** - one or two sentences on what is going on.
**Evidence** - 2 to 4 bullets quoting real numbers or titles, each ending with the section it came from in brackets, e.g. [UPLOADS].
**Recommendation** - what to do and why. For idea requests, put the numbered ideas here, each tied to something in the data.
**Next action** - one concrete thing to do today.

Language: reply in the language and script the creator writes in. If they write Telugu in English letters (Tenglish), reply in Tenglish. If they ask for Telugu, write in Telugu script. Keep the four headings in English so they are easy to scan.
Keep answers under about 250 words unless the creator asks for a list of ideas.`;

export interface CoachStream {
  evidence: Evidence;
  chunks: AsyncGenerator<string>;
}

/** Streams the coach's reply as plain text chunks. Throws on API errors so the caller can show a message. */
export async function streamCoachReply(history: ChatMessage[], viewer: Viewer): Promise<CoachStream> {
  const evidence = await buildEvidence(viewer);

  async function* run() {
    if (!geminiEnabled()) {
      yield ruleBasedReply(history.at(-1)?.content ?? "", evidence);
      return;
    }
    const contents: Content[] = history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    const stream = await gemini().models.generateContentStream({
      model: GEMINI_MODEL,
      contents,
      config: { systemInstruction: `${SYSTEM}\n\nDATA PACK\n${evidence.text}`, maxOutputTokens: 2048 },
    });
    let finish: FinishReason | undefined;
    let blocked = false;
    for await (const chunk of stream) {
      if (chunk.promptFeedback?.blockReason) blocked = true;
      finish = chunk.candidates?.[0]?.finishReason ?? finish;
      if (chunk.text) yield chunk.text;
    }
    if (blocked || (finish && finish !== FinishReason.STOP && finish !== FinishReason.MAX_TOKENS)) {
      yield "\n\n(Gemini stopped this answer because of its safety filters. Try rephrasing the question.)";
    } else if (finish === FinishReason.MAX_TOKENS) {
      yield "\n\n(Answer cut short. Ask me to continue.)";
    }
  }
  return { evidence, chunks: run() };
}

function section(evidence: Evidence, name: string): string[] {
  const m = evidence.text.match(new RegExp(`\\[${name}\\]\\n([\\s\\S]*?)(?=\\n\\n\\[|$)`));
  return m ? m[1].split("\n") : [];
}

/** Offline fallback used when no GEMINI_API_KEY is configured. Quotes the evidence pack; writes nothing creative. Exported for tests. */
export function ruleBasedReply(question: string, evidence: Evidence): string {
  const q = question.toLowerCase();
  const note = "\n\n(Basic mode: this answer was assembled from your data by fixed rules. Add GEMINI_API_KEY for full coaching, ideas and Telugu or Tenglish replies.)";
  if (evidence.source === null) {
    return `**Diagnosis**\nTubeLens has no channel data to work from right now.\n\n**Evidence**\n- ${evidence.text.split("\n")[0]}\n\n**Recommendation**\nConnect your YouTube channel, or switch on Demo mode to see how the Coach works.\n\n**Next action**\nOpen Privacy & settings and connect YouTube.${note}`;
  }
  const demo = evidence.source === "demo" ? "These are demo numbers, not your real channel.\n\n" : "";
  const cards = section(evidence, "FEED CARDS");
  const uploads = section(evidence, "UPLOADS");
  const review = section(evidence, "LATEST VIDEO REVIEW");
  const comps = section(evidence, "COMPETITORS");
  const bullets = (lines: string[], tag: string, n = 3) => lines.filter((l) => l.startsWith("- ")).slice(0, n).map((l) => `${l} [${tag}]`).join("\n");

  let diagnosis: string, ev: string, rec: string, next: string;
  if (/underperform|last video|latest video|title|thumbnail/.test(q) && review.length) {
    diagnosis = `Your latest upload is ${review[0].replace("Video: ", "")}. ${review[1] ?? ""}`;
    ev = [review[2] ? `- ${review[2]} [LATEST VIDEO REVIEW]` : "", bullets(review, "LATEST VIDEO REVIEW")].filter(Boolean).join("\n");
    rec = "Check the views figure against your typical video first: if it is at or above 1x, the video is not underperforming. Then work through any failed checks listed above.";
    next = "Open Optimize, pick this video and fix the first item on its list.";
  } else if (/competitor|compare|gap/.test(q)) {
    diagnosis = comps.length ? "Here is how the channels you track compare, from their recent public uploads." : "You aren't tracking any competitor channels yet, so there is nothing to compare.";
    ev = comps.length ? bullets(comps, "COMPETITORS", 5) : "- No [COMPETITORS] section is available.";
    rec = comps.length ? "Look at the gap topics: they work for those channels and don't appear in your titles or tags." : "Add two or three channels that serve the same audience.";
    next = comps.length ? "Open Competitors and check one gap topic in Keywords." : "Open Competitors and add a channel.";
  } else {
    diagnosis = cards.length ? "Here is what your data points to right now." : "There isn't enough data yet for a specific recommendation.";
    ev = cards.length ? bullets(cards, "FEED CARDS", 4) : bullets(uploads, "UPLOADS");
    rec = cards.length ? "Start with the first item: it has the strongest evidence. Writing new video ideas needs the AI model, which isn't configured." : "Run a niche scan on the Outliers page so there are breakout videos to learn from.";
    next = cards.length ? "Open the Feed and act on the top card." : "Open Outliers and search your niche.";
  }
  return `${demo}**Diagnosis**\n${diagnosis}\n\n**Evidence**\n${ev || "- No matching data."}\n\n**Recommendation**\n${rec}\n\n**Next action**\n${next}${note}`;
}

// ---- Stored conversations ----

export interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
  messages: number;
}

const sourceOf = (viewer: Viewer) => (viewer.mode === "demo" ? "demo" : "youtube");

export function listConversations(viewer: Viewer): ConversationSummary[] {
  return getDb()
    .prepare(
      `SELECT c.id, c.title, c.updated_at, (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = c.id) AS messages
       FROM ai_conversations c WHERE c.user_id = ? AND c.source = ? ORDER BY c.updated_at DESC LIMIT 12`,
    )
    .all(viewer.userId, sourceOf(viewer)) as unknown as ConversationSummary[];
}

export function loadConversation(viewer: Viewer, id: string): ChatMessage[] | null {
  const db = getDb();
  const owned = db.prepare("SELECT 1 FROM ai_conversations WHERE id = ? AND user_id = ? AND source = ?").get(id, viewer.userId, sourceOf(viewer));
  if (!owned) return null;
  return db.prepare("SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY id").all(id) as unknown as ChatMessage[];
}

/** Appends one exchange, creating the conversation if needed. Returns its id. */
export function saveExchange(viewer: Viewer, conversationId: string | null, question: string, answer: string): string {
  const db = getDb();
  ensureUser(viewer.userId);
  let id = conversationId ?? crypto.randomUUID();
  if (!db.prepare("SELECT 1 FROM ai_conversations WHERE id = ? AND user_id = ?").get(id, viewer.userId)) {
    // An id that belongs to someone else is never reused.
    if (db.prepare("SELECT 1 FROM ai_conversations WHERE id = ?").get(id)) id = crypto.randomUUID();
    db.prepare("INSERT INTO ai_conversations (id, user_id, title, source) VALUES (?, ?, ?, ?)").run(id, viewer.userId, question.slice(0, 80), sourceOf(viewer));
  }
  const insert = db.prepare("INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, ?, ?)");
  insert.run(id, "user", question);
  insert.run(id, "assistant", answer);
  db.prepare("UPDATE ai_conversations SET updated_at = datetime('now') WHERE id = ?").run(id);
  return id;
}
