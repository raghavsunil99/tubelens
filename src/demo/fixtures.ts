// DEMO FIXTURES. Everything in this file is made up.
//
// It is only ever read when the app is in Demo mode (see src/lib/mode.ts), and
// every screen that shows it carries a "Demo data" label. Live code paths must
// never import from here except through the `mode === "demo"` branches in the
// feature data layers.
//
// Fixtures are raw inputs (channels, videos, daily stats). Scores, feed cards
// and keyword ratings are computed from them by the same code that runs on
// real data, so the demo shows how the product actually behaves.
import type { AnalyticsDay, Channel, ScanVideo, Video, VideoAnalytics } from "@/lib/youtube/types";

export const DEMO_CHANNEL_ID = "UCdemo000000000000000000";
export const DEMO_NICHE = "budget phones";

const DAY = 86400_000;

// Seeded PRNG (mulberry32) so demo numbers are identical on every render.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Midday UTC `days` ago, so demo dates don't jitter within a day. */
function daysAgo(now: Date, days: number) {
  const d = new Date(now.getTime() - days * DAY);
  d.setUTCHours(12, 30, 0, 0);
  return d;
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const DEMO_CHANNEL: Channel = {
  id: DEMO_CHANNEL_ID,
  title: "Phone Lab (demo channel)",
  handle: "@phonelab-demo",
  thumbnail: null,
  country: "IN",
  uploadsPlaylistId: "UUdemo000000000000000000",
  subscribers: 12_480,
  totalViews: 1_284_330,
  videoCount: 87,
};

const GOOD_DESCRIPTION = (topic: string) =>
  `In this video I test ${topic} the way you'd actually use them: camera, battery, gaming and day-to-day speed. ` +
  `Everything was bought at retail price and nothing here is sponsored.\n\n` +
  `0:00 Why this test\n1:12 Camera\n4:30 Battery\n7:05 Gaming\n9:40 Verdict\n\n` +
  `Full comparison sheet: https://example.com/sheet\nWatch next: my budget phone playlist.\n\n#budgetphones #phonereview`;

interface UploadSeed {
  title: string;
  age: number;
  sec: number;
  views: number;
  likes: number;
  comments: number;
  tags?: string[];
  description?: string;
  /** views per day in the earlier and later half of the snapshot window */
  prior?: number;
  recent?: number;
  avgViewPercent: number;
}

const UPLOADS: UploadSeed[] = [
  { title: "I Tested 9 Budget Phones Under ₹15,000 So You Don't Have To", age: 3, sec: 742, views: 41_200, likes: 2_310, comments: 412, tags: ["budget phones", "phones under 15000", "phone review"], description: GOOD_DESCRIPTION("nine budget phones under ₹15,000"), avgViewPercent: 46 },
  { title: "my honest review after 30 days", age: 6, sec: 611, views: 6_100, likes: 240, comments: 38, tags: [], description: "", avgViewPercent: 27 },
  { title: "Best Phone Under ₹20,000? Camera Test vs 3 Rivals", age: 10, sec: 688, views: 14_800, likes: 790, comments: 131, tags: ["phones under 20000", "camera test", "budget phones"], description: GOOD_DESCRIPTION("four phones under ₹20,000"), avgViewPercent: 41 },
  { title: "Top 5 Earbuds Under ₹2,000", age: 13, sec: 505, views: 7_900, likes: 360, comments: 52, tags: ["earbuds", "budget earbuds"], description: "My five picks for earbuds under ₹2,000 this year, ranked by sound and battery.\n\nLinks: https://example.com/earbuds", avgViewPercent: 38 },
  { title: "This ₹999 Gadget Surprised Me", age: 17, sec: 48, views: 22_400, likes: 1_480, comments: 96, tags: ["gadgets", "shorts"], description: "#shorts #gadgets", avgViewPercent: 88 },
  { title: "PHONE CAMERA SETTINGS NOBODY USES!!! #tech #phone #camera", age: 20, sec: 540, views: 5_200, likes: 210, comments: 29, tags: ["camera settings"], description: "camera settings video", avgViewPercent: 29 },
  { title: "Battery Test: 5 Phones, 1 Day, 1 Clear Winner", age: 24, sec: 803, views: 12_900, likes: 705, comments: 118, tags: ["battery test", "budget phones"], description: GOOD_DESCRIPTION("five phones' batteries"), avgViewPercent: 43 },
  { title: "Is 5G Worth It Yet?", age: 27, sec: 462, views: 4_300, likes: 170, comments: 44, tags: ["5g"], description: "A quick look at whether 5G is worth paying extra for in India right now.", avgViewPercent: 34 },
  { title: "Unboxing the Tiniest Projector | Full Review, Setup, Picture Quality and Everything Else You Need to Know", age: 31, sec: 934, views: 3_900, likes: 150, comments: 21, tags: ["projector", "unboxing"], description: GOOD_DESCRIPTION("a pocket projector"), avgViewPercent: 24 },
  { title: "Don't Buy a Smartwatch Before Watching This", age: 38, sec: 577, views: 9_600, likes: 520, comments: 77, tags: ["smartwatch", "buying guide"], description: GOOD_DESCRIPTION("budget smartwatches"), avgViewPercent: 39 },
  { title: "రూ.15,000 లోపు బెస్ట్ ఫోన్ ఏది?", age: 45, sec: 655, views: 11_300, likes: 880, comments: 164, tags: ["budget phones", "telugu tech"], description: "రూ.15,000 లోపు బెస్ట్ ఫోన్ల పూర్తి పోలిక. కెమెరా, బ్యాటరీ, గేమింగ్.\n\n0:00 Intro\n1:30 Camera\n5:00 Battery\n8:10 Verdict\n\nhttps://example.com/telugu\n#telugutech #budgetphones", avgViewPercent: 44 },
  { title: "The Phone I'd Buy With My Own Money in 2026", age: 52, sec: 712, views: 18_700, likes: 1_020, comments: 203, tags: ["best phone 2026", "budget phones"], description: GOOD_DESCRIPTION("the phones I'd actually buy"), prior: 410, recent: 140, avgViewPercent: 42 },
  { title: "Fast Charging Myths, Tested", age: 59, sec: 498, views: 6_800, likes: 300, comments: 41, tags: ["fast charging"], description: "Does fast charging hurt your battery? I measured it for a month.\n\nhttps://example.com/charging", avgViewPercent: 36 },
  { title: "Laptop Under ₹50,000? Watch This First", age: 66, sec: 760, views: 8_400, likes: 390, comments: 66, tags: ["laptop under 50000"], description: GOOD_DESCRIPTION("laptops under ₹50,000"), avgViewPercent: 37 },
];

const uploadId = (i: number) => `demo_own_${String(i).padStart(2, "0")}`;

export function demoUploads(now = new Date()): Video[] {
  return UPLOADS.map((u, i) => ({
    id: uploadId(i),
    channelId: DEMO_CHANNEL_ID,
    channelTitle: DEMO_CHANNEL.title,
    title: u.title,
    description: u.description ?? "",
    tags: u.tags ?? [],
    publishedAt: daysAgo(now, u.age).toISOString(),
    durationSec: u.sec,
    thumbnail: null,
    categoryId: "28",
    language: i === 10 ? "te" : "en",
    views: u.views,
    likes: u.likes,
    comments: u.comments,
  }));
}

export function demoVideoAnalytics(): VideoAnalytics[] {
  return UPLOADS.map((u, i) => ({
    videoId: uploadId(i),
    views: u.views,
    watchMinutes: Math.round((u.views * u.sec * (u.avgViewPercent / 100)) / 60),
    avgViewDurationSec: Math.round(u.sec * (u.avgViewPercent / 100)),
    avgViewPercent: u.avgViewPercent,
  }));
}

export const DEMO_SNAPSHOT_DAYS = 14;

/** 14 days of per-video view snapshots, ending today at each video's current views. */
export function demoVideoSnapshots(now = new Date()) {
  const rows: { videoId: string; day: string; views: number }[] = [];
  UPLOADS.forEach((u, i) => {
    const steady = Math.max(4, Math.round((u.views / u.age) * 0.25));
    const prior = u.prior ?? steady;
    const recent = u.recent ?? steady;
    let views = u.views;
    for (let d = 0; d < Math.min(DEMO_SNAPSHOT_DAYS, u.age); d++) {
      rows.push({ videoId: uploadId(i), day: ymd(daysAgo(now, d)), views });
      views = Math.max(0, views - (d < DEMO_SNAPSHOT_DAYS / 2 ? recent : prior));
    }
  });
  return rows;
}

export interface DemoHistoryDay extends AnalyticsDay {
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
}

/** 30 days of channel history ending today at the demo channel's current totals. */
export function demoHistory(now = new Date()): DemoHistoryDay[] {
  const r = rng(11);
  const uploadDays = new Set(UPLOADS.map((u) => u.age));
  const days: DemoHistoryDay[] = [];
  let subs = DEMO_CHANNEL.subscribers!;
  let total = DEMO_CHANNEL.totalViews;
  let videos = DEMO_CHANNEL.videoCount;
  for (let d = 0; d < 30; d++) {
    // Views bump on and just after upload days.
    const bump = uploadDays.has(d) ? 1.9 : uploadDays.has(d + 1) ? 1.4 : 1;
    const views = Math.round((2_300 + r() * 700) * bump);
    const gained = Math.round(views / 95 + r() * 6);
    const lost = Math.round(3 + r() * 5);
    days.push({
      day: ymd(daysAgo(now, d)),
      views,
      watchMinutes: Math.round(views * (2.2 + r() * 0.5)),
      avgViewDurationSec: Math.round(150 + r() * 40),
      subsGained: gained,
      subsLost: lost,
      likes: Math.round(views * 0.045),
      comments: Math.round(views * 0.006),
      subscriberCount: subs,
      viewCount: total,
      videoCount: videos,
    });
    subs -= gained - lost;
    total -= views;
    if (uploadDays.has(d)) videos -= 1;
  }
  return days.reverse();
}

// ---- A fixed sample of "search results" for Outliers and Keywords ----

const SCAN_CHANNELS: Record<string, { subs: number; videos: number; avg: number }> = {
  "Gadget Guru": { subs: 620_000, videos: 540, avg: 96_000 },
  "Tech Simplified": { subs: 1_900_000, videos: 1_120, avg: 310_000 },
  "Byte Size": { subs: 9_400, videos: 64, avg: 2_100 },
  "Mobile Mantra": { subs: 15_200, videos: 131, avg: 3_800 },
  "Unbox Daily": { subs: 240_000, videos: 780, avg: 41_000 },
  "Spec Sheet": { subs: 38_000, videos: 212, avg: 7_400 },
  "Telugu Tech Talks": { subs: 310_000, videos: 460, avg: 58_000 },
  "Pocket Reviews": { subs: 4_100, videos: 37, avg: 1_300 },
};

const SCAN: { title: string; channel: string; x: number; age: number; sec: number; tags: string[]; lang?: string }[] = [
  { title: "I Used a ₹9,999 Phone for 30 Days. Here's the Truth", channel: "Byte Size", x: 31, age: 9, sec: 702, tags: ["budget phones", "phone under 10000"] },
  { title: "Best Budget Phones 2026: Camera Test Shocked Me", channel: "Mobile Mantra", x: 18.5, age: 14, sec: 815, tags: ["budget phones", "camera test"] },
  { title: "This ₹12,000 Phone Camera Beat an iPhone?", channel: "Pocket Reviews", x: 22, age: 6, sec: 44, tags: ["camera test", "shorts"] },
  { title: "Top 5 Budget Phones Under ₹15,000 (Ranked)", channel: "Spec Sheet", x: 9.2, age: 21, sec: 640, tags: ["budget phones", "phones under 15000"] },
  { title: "రూ.10,000 లోపు బెస్ట్ కెమెరా ఫోన్ | Camera Test", channel: "Telugu Tech Talks", x: 6.4, age: 11, sec: 588, tags: ["telugu tech", "camera test"], lang: "te" },
  { title: "Don't Buy a Budget Phone Before Watching This", channel: "Gadget Guru", x: 4.8, age: 26, sec: 731, tags: ["budget phones", "buying guide"] },
  { title: "Budget Phones vs Flagship: Camera Test in Low Light", channel: "Unbox Daily", x: 5.6, age: 17, sec: 862, tags: ["camera test", "budget phones"] },
  { title: "5 Budget Phone Mistakes Everyone Makes", channel: "Spec Sheet", x: 7.1, age: 33, sec: 512, tags: ["budget phones", "buying guide"] },
  { title: "Cheapest 5G Phone in India: Unboxing", channel: "Unbox Daily", x: 3.4, age: 8, sec: 52, tags: ["5g phone", "unboxing"] },
  { title: "₹15,000 में सबसे अच्छा फोन कौन सा है?", channel: "Tech Simplified", x: 2.9, age: 19, sec: 695, tags: ["budget phones", "hindi tech"], lang: "hi" },
  { title: "Battery Test: 6 Budget Phones Until They Die", channel: "Mobile Mantra", x: 11.3, age: 29, sec: 947, tags: ["battery test", "budget phones"] },
  { title: "Why I Stopped Recommending This Budget Phone", channel: "Byte Size", x: 13.8, age: 41, sec: 604, tags: ["budget phones", "phone review"] },
  { title: "Budget Phones for Gaming: BGMI Test", channel: "Gadget Guru", x: 2.2, age: 37, sec: 771, tags: ["gaming phone", "budget phones"] },
  { title: "The Budget Phone Nobody Is Talking About", channel: "Pocket Reviews", x: 16.4, age: 23, sec: 566, tags: ["budget phones", "phone review"] },
  { title: "Best Phone Under ₹20,000? Honest Comparison", channel: "Tech Simplified", x: 1.6, age: 12, sec: 889, tags: ["phones under 20000", "budget phones"] },
  { title: "Budget Phone Camera Settings You Should Change", channel: "Spec Sheet", x: 4.1, age: 48, sec: 433, tags: ["camera settings", "budget phones"] },
  { title: "I Bought the Cheapest Phone on Flipkart", channel: "Unbox Daily", x: 3.9, age: 55, sec: 58, tags: ["cheapest phone", "shorts"] },
  { title: "Budget Phones 2026: What Changed This Year", channel: "Gadget Guru", x: 1.9, age: 62, sec: 720, tags: ["budget phones 2026", "budget phones"] },
  { title: "Telugu Tech: ₹12,000 Phone Full Review", channel: "Telugu Tech Talks", x: 2.4, age: 31, sec: 655, tags: ["telugu tech", "phone review"], lang: "te" },
  { title: "Is a Used Flagship Better Than a New Budget Phone?", channel: "Mobile Mantra", x: 8.7, age: 44, sec: 698, tags: ["used phones", "budget phones"] },
  { title: "Budget Phone Unboxing and First Impressions", channel: "Tech Simplified", x: 0.7, age: 4, sec: 480, tags: ["unboxing", "budget phones"] },
  { title: "Fast Charging on Budget Phones: Safe or Not?", channel: "Spec Sheet", x: 3.1, age: 70, sec: 541, tags: ["fast charging", "budget phones"] },
];

export function demoScan(now = new Date()): ScanVideo[] {
  const r = rng(42);
  const ids = Object.keys(SCAN_CHANNELS);
  return SCAN.map((s, i) => {
    const c = SCAN_CHANNELS[s.channel];
    const views = Math.round(c.avg * s.x);
    return {
      id: `demo_scan_${String(i).padStart(2, "0")}`,
      channelId: `UCdemoscan${ids.indexOf(s.channel)}`,
      channelTitle: s.channel,
      title: s.title,
      description: "",
      tags: s.tags,
      publishedAt: daysAgo(now, s.age).toISOString(),
      durationSec: s.sec,
      thumbnail: null,
      categoryId: "28",
      language: s.lang ?? "en",
      views,
      likes: Math.round(views * (0.03 + r() * 0.04)),
      comments: Math.round(views * (0.003 + r() * 0.006)),
      channel: {
        id: `UCdemoscan${ids.indexOf(s.channel)}`,
        title: s.channel,
        subscribers: c.subs,
        totalViews: c.avg * c.videos + views,
        videoCount: c.videos + 1,
        country: "IN",
      },
    };
  });
}

// ---- Demo competitors ----

const COMPETITOR_NAMES = ["Spec Sheet", "Mobile Mantra", "Unbox Daily"];

export function demoCompetitors(now = new Date()) {
  const scan = demoScan(now);
  return COMPETITOR_NAMES.map((name, n) => {
    const c = SCAN_CHANNELS[name];
    const id = `UCdemoscan${Object.keys(SCAN_CHANNELS).indexOf(name)}`;
    const r = rng(100 + n);
    const own = scan.filter((v) => v.channelTitle === name);
    // Pad each channel out to 12 uploads with ordinary-performing videos.
    const filler: Video[] = Array.from({ length: 12 - own.length }, (_, i) => ({
      id: `demo_comp_${n}_${i}`,
      channelId: id,
      channelTitle: name,
      title: ["Weekly Tech News Roundup", "Unboxing: New Launch This Week", "Q&A: Your Phone Questions", "Budget Earbuds Quick Review", "Smartwatch Under ₹3,000 Review", "Phone Accessories Worth Buying", "Camera Comparison: Day vs Night", "Is This Tablet Worth It?", "Charger Safety Test"][i % 9],
      description: "",
      tags: [],
      publishedAt: daysAgo(now, 5 + i * (name === "Unbox Daily" ? 3 : 6)).toISOString(),
      durationSec: name === "Unbox Daily" && i % 2 === 0 ? 50 : 420 + Math.round(r() * 400),
      thumbnail: null,
      categoryId: "28",
      language: "en",
      views: Math.round(c.avg * (0.5 + r())),
      likes: Math.round(c.avg * 0.03),
      comments: Math.round(c.avg * 0.004),
    }));
    const uploads: Video[] = [...own, ...filler].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    const channel: Channel = {
      id,
      title: name,
      handle: `@${name.toLowerCase().replace(/\s+/g, "")}-demo`,
      thumbnail: null,
      country: "IN",
      uploadsPlaylistId: null,
      subscribers: c.subs,
      totalViews: c.avg * c.videos,
      videoCount: c.videos,
    };
    const weeklySubs = Math.round(c.subs * (0.004 + n * 0.003));
    const snapshots = Array.from({ length: 10 }, (_, d) => ({
      day: ymd(daysAgo(now, d)),
      subscriber_count: c.subs - Math.round((weeklySubs / 7) * d),
      view_count: c.avg * c.videos - Math.round(((c.avg * 2) / 7) * d),
      video_count: c.videos - (d >= 5 ? 1 : 0),
    })).reverse();
    return { channel, uploads, snapshots };
  });
}

export const DEMO_KEYWORDS = ["budget phones", "camera test", "phones under 15000"];
