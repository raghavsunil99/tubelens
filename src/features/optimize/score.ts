// Explainable review of one upload. Results are bands ("Strong", "Okay",
// "Needs work") backed by named checks, not 0-100 scores: nothing here is
// precise enough to deserve two digits.
import { latinShare, terms, detectScript } from "@/lib/text";
import { isShort, type Video, type VideoAnalytics } from "@/lib/youtube/types";

export type Band = "Strong" | "Okay" | "Needs work";

export interface Check {
  label: string;
  /** null = not assessed (for example, an English-only check on a Telugu title) */
  pass: boolean | null;
  detail: string;
}

export interface Graded {
  /** null when too few checks could be assessed */
  band: Band | null;
  checks: Check[];
}

export interface VideoReview {
  videoId: string;
  titleClarity: Graded;
  topicRelevance: { band: Band | null; detail: string; shared: string[] };
  hook: Graded;
  description: Graded;
  /** Things only the creator can judge by looking at the thumbnail. */
  thumbnailChecklist: string[];
  retention: {
    /** Real numbers from YouTube Analytics, when the creator is connected. */
    measured: { avgViewPercent: number; avgViewDurationSec: number } | null;
    hypothesis: string;
  };
  suggestions: string[];
  rewrites: { title: string; why: string }[];
}

export function band(checks: Check[]): Band | null {
  const assessed = checks.filter((c) => c.pass !== null);
  if (assessed.length < 2) return null;
  const ratio = assessed.filter((c) => c.pass).length / assessed.length;
  return ratio >= 0.8 ? "Strong" : ratio >= 0.5 ? "Okay" : "Needs work";
}

const EMOJI = /\p{Extended_Pictographic}/gu;
const SEPARATORS = /\s[|\-–—:]\s|:\s/g;

function titleClarity(v: Video, topicTerms: string[]): Graded {
  const title = v.title.trim();
  const len = [...title].length;
  const english = latinShare(title) >= 0.5;
  const letters = title.match(/[A-Za-z]/g) ?? [];
  const upper = letters.filter((c) => c === c.toUpperCase()).length;
  const emoji = (title.match(EMOJI) ?? []).length;
  const hashtags = (title.match(/#\w+/g) ?? []).length;
  const parts = title.split(SEPARATORS).length;
  const head = title.slice(0, 40).toLowerCase();
  const topicHit = topicTerms.find((t) => head.includes(t));

  const checks: Check[] = [
    {
      label: "Fits without being cut off",
      pass: len >= 20 && len <= 60,
      detail: len > 60 ? `${len} characters. Mobile cuts titles at about 60.` : len < 20 ? `${len} characters. There's room to say what the video is about.` : `${len} characters.`,
    },
    {
      label: "Topic comes first",
      pass: topicTerms.length === 0 ? null : Boolean(topicHit),
      detail:
        topicTerms.length === 0
          ? "No tags or niche to compare with, so this wasn't checked."
          : topicHit
            ? `"${topicHit}" appears in the first 40 characters.`
            : "None of your tags or niche words appear in the first 40 characters.",
    },
    {
      label: "Not shouting",
      pass: letters.length < 8 ? null : upper / letters.length <= 0.5,
      detail: letters.length < 8 ? "Not assessed for this script." : `${Math.round((upper / letters.length) * 100)}% of letters are capitals.`,
    },
    {
      label: "Clean punctuation",
      pass: !/[!?]{2,}/.test(title) && emoji <= 1 && hashtags <= 1,
      detail: [/[!?]{2,}/.test(title) && "repeated !/?", emoji > 1 && `${emoji} emoji`, hashtags > 1 && `${hashtags} hashtags`].filter(Boolean).join(", ") || "No clutter.",
    },
    {
      label: "Has a concrete detail",
      pass: /\d|[₹$%]/.test(title),
      detail: /\d|[₹$%]/.test(title) ? "Includes a number, price or year." : "No number, price or year. A specific detail makes the promise believable.",
    },
    {
      label: "One clear idea",
      pass: parts <= 2,
      detail: parts <= 2 ? "Reads as a single idea." : `Split into ${parts} parts by separators.`,
    },
  ];
  if (!english) checks[2] = { ...checks[2], pass: null, detail: `Not assessed for ${detectScript(title)} titles.` };
  return { band: band(checks), checks };
}

const TENSION = /\b(why|how|truth|mistakes?|secret|nobody|no one|before|stop|never|don'?t|vs|versus|worst|best|honest|tested|surprised?|finally|actually|wrong|real|only|every)\b/i;

function hookStrength(v: Video): Graded {
  const title = v.title.trim();
  if (latinShare(title) < 0.5) {
    const note = `These checks look for English words, so they weren't run on this ${detectScript(title)} title.`;
    return { band: null, checks: [{ label: "Hook checks", pass: null, detail: note }] };
  }
  const checks: Check[] = [
    {
      label: "Creates curiosity or tension",
      pass: TENSION.test(title),
      detail: TENSION.test(title) ? `Uses "${title.match(TENSION)![0]}".` : "No curiosity or tension word (why, vs, mistake, tested, honest…).",
    },
    {
      label: "Promises a result or stake",
      pass: /\d|[₹$%]|\b(free|faster|easy|cheap|save|earn|win|lose)\b/i.test(title),
      detail: /\d|[₹$%]/.test(title) ? "Names a number or amount." : "No number, amount or outcome word.",
    },
    {
      label: "Speaks to or as a person",
      pass: /\b(i|i'm|i've|my|we|you|your|you're)\b/i.test(title),
      detail: /\b(i|i'm|i've|my|we|you|your|you're)\b/i.test(title) ? "Uses I / my / you." : "Written impersonally. \"I\" or \"you\" often reads as more direct.",
    },
    {
      label: "Leaves something open",
      pass: /\?|\.\.\.|…|\bthis\b|\bwhat happened\b|\bhere'?s\b/i.test(title),
      detail: /\?|\.\.\.|…|\bthis\b|\bwhat happened\b|\bhere'?s\b/i.test(title) ? "Leaves a question for the video to answer." : "The title gives everything away, or nothing to wonder about.",
    },
  ];
  return { band: band(checks), checks };
}

function topicRelevance(v: Video): VideoReview["topicRelevance"] {
  const titleTerms = new Set(terms(v.title));
  const support = new Set([...v.tags.flatMap((t) => terms(t)), ...terms(v.description.slice(0, 300))]);
  if (support.size === 0) {
    return { band: "Needs work", shared: [], detail: "There is no description or tags, so YouTube has only the title to understand the topic." };
  }
  const shared = [...titleTerms].filter((t) => support.has(t));
  const b: Band = shared.length >= 3 ? "Strong" : shared.length >= 1 ? "Okay" : "Needs work";
  return {
    band: b,
    shared,
    detail:
      shared.length === 0
        ? "The title shares no key words with the description's opening or the tags."
        : `The title shares ${shared.length} key word${shared.length === 1 ? "" : "s"} with the description's opening and tags: ${shared.slice(0, 5).join(", ")}.`,
  };
}

function descriptionChecks(v: Video): Graded {
  const d = v.description.trim();
  const short = isShort(v);
  const opening = new Set(terms(d.slice(0, 150)));
  const titleHit = terms(v.title).find((t) => opening.has(t));
  const stamps = d.match(/(^|\s)\d{1,2}:\d{2}(:\d{2})?\b/g) ?? [];
  const hashtags = (d.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
  const checks: Check[] = [
    {
      label: "Long enough to describe the video",
      pass: short ? null : d.length >= 250,
      detail: short ? "Not needed for Shorts." : `${d.length} characters${d.length < 250 ? ". Aim for a few sentences (250+)." : "."}`,
    },
    {
      label: "Opening repeats the topic",
      pass: d.length === 0 ? false : Boolean(titleHit),
      detail: d.length === 0 ? "The description is empty." : titleHit ? `The first lines mention "${titleHit}".` : "The first 150 characters share no key word with the title.",
    },
    {
      label: "Has chapters",
      pass: short || v.durationSec < 300 ? null : stamps.length >= 3,
      detail: short || v.durationSec < 300 ? "Not needed for videos under 5 minutes." : stamps.length >= 3 ? `${stamps.length} timestamps found.` : "No chapter timestamps (0:00 …) found.",
    },
    {
      label: "Points viewers somewhere next",
      pass: /https?:\/\/|\bsubscribe\b|\bplaylist\b|\bwatch next\b/i.test(d),
      detail: /https?:\/\//.test(d) ? "Includes a link." : "No link, playlist or next-video pointer.",
    },
    {
      label: "Uses 1 to 3 hashtags",
      pass: hashtags >= 1 && hashtags <= 3,
      detail: `${hashtags} hashtag${hashtags === 1 ? "" : "s"}.`,
    },
  ];
  return { band: band(checks), checks };
}

const THUMBNAIL_CHECKLIST = [
  "One clear subject you can recognise at phone size",
  "Three words or fewer of text, readable when the thumbnail is small",
  "Says something the title doesn't (they should work as a pair)",
  "Strong contrast between subject and background",
  "A face or object showing emotion or a result, if it suits the video",
  "Nothing important in the bottom-right corner, where the duration sits",
];

function retentionHypothesis(v: Video, measured: VideoReview["retention"]["measured"]) {
  const t = v.title;
  let promise: string;
  if (/\d+\s+\w+|\btop\b|\branked\b/i.test(t)) promise = "Show the full list or ranking criteria and tease the top pick within the first 15 seconds.";
  else if (/\?/.test(t)) promise = "Repeat the question in the first sentence and say when the answer comes.";
  else if (/\bvs\.?\b|\bversus\b/i.test(t)) promise = "Put both options on screen side by side straight away.";
  else if (/\bhow to\b|\btutorial\b/i.test(t)) promise = "Show the finished result first, then start step one.";
  else promise = "Say what the viewer gets in the first sentence and cut any intro before it.";

  let lead = "Hypothesis (not measured): viewers who clicked this title stay if the opening confirms the promise quickly. ";
  if (measured && !isShort(v)) {
    lead =
      measured.avgViewPercent < 30
        ? `Viewers watch ${Math.round(measured.avgViewPercent)}% of this video on average, which is on the low side and usually means an early drop. Hypothesis: the opening doesn't confirm the title's promise fast enough. `
        : `Viewers watch ${Math.round(measured.avgViewPercent)}% of this video on average. Hypothesis: the opening is doing its job; `;
  }
  return `${lead}${promise}`;
}

/** Rewrites that follow mechanically from a failed check. Anything creative is left to the creator or the Coach. */
export function rewriteTitle(title: string): { title: string; why: string }[] {
  const out: { title: string; why: string }[] = [];
  const add = (next: string, why: string) => {
    const clean = next.replace(/\s+/g, " ").trim();
    if (clean && clean !== title && !out.some((o) => o.title === clean)) out.push({ title: clean, why });
  };
  let t = title.trim();

  if (/#\w+/.test(t)) {
    t = t.replace(/\s*#[\p{L}\p{N}_]+/gu, "");
    add(t, "Moved hashtags out of the title (they belong in the description).");
  }
  if (/[!?]{2,}/.test(t)) {
    t = t.replace(/([!?])[!?]+/g, "$1");
    add(t, "Removed repeated punctuation.");
  }
  const letters = t.match(/[A-Za-z]/g) ?? [];
  if (letters.length >= 8 && letters.filter((c) => c === c.toUpperCase()).length / letters.length > 0.5) {
    t = t.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
    add(t, "Switched from all capitals to title case.");
  }
  if ([...t].length > 60) {
    const segments = t.split(/\s[|\-–—]\s/);
    if (segments.length > 1 && [...segments[0]].length >= 20) add(segments[0], "Kept the main idea and dropped the part after the separator.");
    const cut = [...t].slice(0, 60).join("");
    add(cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,:;|\-–—]+$/, ""), "Trimmed to fit within 60 characters.");
  }
  return out.slice(0, 3);
}

export function reviewVideo(v: Video, opts: { nicheTerms?: string[]; analytics?: VideoAnalytics | null } = {}): VideoReview {
  const topicTerms = [...new Set([...v.tags.slice(0, 5).flatMap((t) => terms(t)), ...(opts.nicheTerms ?? [])])];
  const clarity = titleClarity(v, topicTerms);
  const hook = hookStrength(v);
  const relevance = topicRelevance(v);
  const description = descriptionChecks(v);
  const measured = opts.analytics
    ? { avgViewPercent: opts.analytics.avgViewPercent, avgViewDurationSec: opts.analytics.avgViewDurationSec }
    : null;

  const suggestions = [
    ...clarity.checks.filter((c) => c.pass === false).map((c) => `Title fails "${c.label}": ${c.detail}`),
    ...(relevance.band === "Needs work" ? [`Topic: ${relevance.detail}`] : []),
    ...description.checks.filter((c) => c.pass === false).map((c) => `Description fails "${c.label}": ${c.detail}`),
    ...hook.checks.filter((c) => c.pass === false).slice(0, 2).map((c) => `Hook: ${c.detail}`),
  ];

  return {
    videoId: v.id,
    titleClarity: clarity,
    topicRelevance: relevance,
    hook,
    description,
    thumbnailChecklist: THUMBNAIL_CHECKLIST,
    retention: { measured, hypothesis: retentionHypothesis(v, measured) },
    suggestions,
    rewrites: rewriteTitle(v.title),
  };
}

/** How many checks failed, used to sort "fix these first". */
export function issueCount(r: VideoReview) {
  return [...r.titleClarity.checks, ...r.description.checks, ...r.hook.checks].filter((c) => c.pass === false).length;
}
