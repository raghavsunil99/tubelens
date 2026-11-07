// Deterministic mock data so every page renders without a backend or API key.
// Replace each generator with a real data source as you build it out.
import type {
  ChannelSearchResult,
  ChannelStats,
  Competitor,
  Conversation,
  CreditBalance,
  FeedCard,
  KeywordTrend,
  OptimizeVideo,
  VideoOutlier,
} from "./types";

export const DEMO_CHANNEL_ID = "UCdemo000000000000000000";

// Small seeded PRNG (mulberry32) so mock numbers are stable between renders.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NICHES = [
  { niche: "Tech", sub: "Smartphones" },
  { niche: "Personal Finance", sub: "Investing" },
  { niche: "Cooking", sub: "Indian Recipes" },
  { niche: "Gaming", sub: "Minecraft" },
  { niche: "Education", sub: "Science Explainers" },
  { niche: "Fitness", sub: "Home Workouts" },
];

const TITLE_TEMPLATES = [
  "I Tried {x} for 30 Days (Shocking Results)",
  "Why Nobody Talks About {x}",
  "{x} Explained in 10 Minutes",
  "The Truth About {x} in 2026",
  "Stop Doing This With {x}",
  "I Ranked Every {x}",
  "Beginner's Guide to {x}",
  "{x}: What They Don't Tell You",
];

const TOPICS = [
  "Budget Phones",
  "Index Funds",
  "Biryani",
  "Redstone Builds",
  "Black Holes",
  "Calisthenics",
  "AI Tools",
  "Side Hustles",
  "Meal Prep",
  "Speedruns",
];

export function mockChannelStats(channelId = DEMO_CHANNEL_ID): ChannelStats {
  return {
    channelId,
    current: { viewCount: 1_284_330, subscriberCount: 12_480, videoCount: 87 },
    previous: { viewCount: 1_201_904, subscriberCount: 11_920, videoCount: 84 },
  };
}

export function mockFeed(channelId = DEMO_CHANNEL_ID): FeedCard[] {
  const now = Date.now();
  const iso = (offsetH: number) => new Date(now + offsetH * 3600_000).toISOString();
  const gen = "gen_demo_001";
  return [
    {
      id: "card_1",
      channelId,
      cardType: "video_idea",
      resourceId: "idea_1",
      resourceType: "idea",
      status: "new",
      cardData: {
        title: "Budget Phones Ranked: Every Model Under ₹15k",
        body: "Ranking videos in your niche are getting 3.4x their channel average this month.",
        metric: { label: "Predicted views", value: "18k–32k" },
      },
      llmData: {
        reasoning: "3 outliers in Smartphones this week use a ranked-list format.",
        suggestedTitles: [
          "I Ranked Every Budget Phone of 2026",
          "Best Phone Under ₹15k? I Tested 9",
        ],
      },
      generationId: gen,
      unlocksAt: null,
      createdAt: iso(-2),
    },
    {
      id: "card_2",
      channelId,
      cardType: "outlier_alert",
      resourceId: "vid_outlier_3",
      resourceType: "video",
      status: "new",
      cardData: {
        title: "A competitor video is breaking out",
        body: "“Why Nobody Talks About AI Tools” is at 11.2x its channel average after 4 days.",
        metric: { label: "Outlier score", value: "11.2x" },
      },
      llmData: null,
      generationId: gen,
      unlocksAt: null,
      createdAt: iso(-5),
    },
    {
      id: "card_3",
      channelId,
      cardType: "launch_window",
      resourceId: "slot_1",
      resourceType: "channel",
      status: "new",
      cardData: {
        title: "Best time to publish this week",
        body: "Your audience peaks Thursday 6–8 PM IST. Uploading 2h before the peak gives the algorithm time to test.",
        metric: { label: "Suggested slot", value: "Thu 4:00 PM" },
      },
      llmData: null,
      generationId: gen,
      unlocksAt: null,
      createdAt: iso(-8),
    },
    {
      id: "card_4",
      channelId,
      cardType: "keyword_trend",
      resourceId: "kw_ai_tools",
      resourceType: "keyword",
      status: "new",
      cardData: {
        title: "“ai tools for students” is rising",
        body: "Search interest is up 64% over 7 days with low competition.",
        metric: { label: "Overall score", value: "78/100" },
      },
      llmData: null,
      generationId: gen,
      unlocksAt: null,
      createdAt: iso(-12),
    },
    {
      id: "card_5",
      channelId,
      cardType: "title_boost",
      resourceId: "vid_own_2",
      resourceType: "video",
      status: "new",
      cardData: {
        title: "Your latest video's title could score higher",
        body: "Current title score 54. A curiosity-gap rewrite scores 81.",
        metric: { label: "Title score", value: "54 → 81" },
      },
      llmData: { suggestedTitles: ["The Phone Mistake 90% of Buyers Make"] },
      generationId: gen,
      unlocksAt: null,
      createdAt: iso(-20),
    },
    {
      id: "card_6",
      channelId,
      cardType: "video_idea",
      resourceId: "idea_2",
      resourceType: "idea",
      status: "new",
      cardData: {
        title: "Tomorrow's idea unlocks soon",
        body: "A new idea is generated for your channel every day.",
      },
      llmData: null,
      generationId: gen,
      unlocksAt: iso(14),
      createdAt: iso(-1),
    },
  ];
}

export function mockOutliers(count = 36): VideoOutlier[] {
  const r = rng(42);
  const out: VideoOutlier[] = [];
  for (let i = 0; i < count; i++) {
    const n = NICHES[Math.floor(r() * NICHES.length)];
    const topic = TOPICS[Math.floor(r() * TOPICS.length)];
    const title = TITLE_TEMPLATES[Math.floor(r() * TITLE_TEMPLATES.length)].replace("{x}", topic);
    const subs = Math.floor(2_000 + r() * 900_000);
    const avg = Math.max(500, Math.floor(subs * (0.05 + r() * 0.3)));
    const score = 1 + r() * r() * 25;
    const views = Math.floor(avg * score);
    out.push({
      video_id: `vid_outlier_${i}`,
      video_title: title,
      video_published_at: Math.floor(Date.now() / 1000 - r() * 60 * 86400),
      video_duration: r() < 0.3 ? Math.floor(15 + r() * 45) : Math.floor(240 + r() * 1500),
      video_thumbnail: "",
      channel_id: `UCmock${i.toString().padStart(4, "0")}`,
      channel_title: `${n.sub} ${["Lab", "Daily", "Guru", "Hub", "TV"][i % 5]}`,
      channel_country: ["IN", "US", "GB", "CA"][Math.floor(r() * 4)],
      channel_language: r() < 0.7 ? "en" : "hi",
      subscriber_count: subs,
      main_category: n.niche,
      view_count: views,
      avg_views: avg,
      outlier_score: Math.round((views / avg) * 10) / 10,
    });
  }
  return out.sort((a, b) => b.outlier_score - a.outlier_score);
}

export function mockChannelSearch(): ChannelSearchResult[] {
  const r = rng(7);
  return Array.from({ length: 18 }, (_, i) => {
    const n = NICHES[i % NICHES.length];
    const subs = Math.floor(5_000 + r() * 2_000_000);
    const videos = Math.floor(20 + r() * 800);
    const avgViews = Math.floor(subs * (0.03 + r() * 0.4));
    return {
      channelId: `UCsearch${i.toString().padStart(4, "0")}`,
      channelTitle: `${n.sub} ${["Simplified", "With Ravi", "Pro", "Insider", "Corner", "Nation"][i % 6]}`,
      handle: `@${n.sub.toLowerCase().replace(/\s+/g, "")}${i}`,
      niche: n.niche,
      nicheConfidence: Math.round((0.6 + r() * 0.4) * 100) / 100,
      mainCategory: n.niche,
      country: ["IN", "US", "GB"][i % 3],
      languages: r() < 0.7 ? "en" : "hi",
      subscriberCount: subs,
      viewCount: avgViews * videos,
      videoCount: videos,
      avgViews,
      estimatedEarnings: Math.floor(avgViews * videos * 0.0015),
      isFaceless: r() < 0.35,
      isPodcast: r() < 0.15,
    };
  });
}

export function mockKeywordTrends(topic = "tech"): KeywordTrend[] {
  const seeds = [
    "ai tools for students",
    "best budget phone 2026",
    "how to start investing",
    "chatgpt tricks",
    "iphone 18 leaks",
    "passive income ideas",
    "laptop under 50000",
    "youtube automation",
    "study with me",
    "home workout no equipment",
    "minecraft hardcore",
    "instant pot recipes",
  ];
  const r = rng(topic.length * 31 + 3);
  return seeds.map((keyword) => {
    const volume = Math.floor(20 + r() * 80);
    const competition = Math.floor(10 + r() * 85);
    return {
      keyword,
      language: "en",
      volume,
      competition,
      // Same idea as vidIQ's "overall": high volume, low competition = high score.
      overall: Math.round(volume * 0.6 + (100 - competition) * 0.4),
      estimated_monthly_search: Math.floor(volume * volume * 40 * (0.5 + r())),
      period_percent_change: Math.round((r() * 160 - 30) * 10) / 10,
    };
  });
}

export function mockCompetitors(): Competitor[] {
  const r = rng(99);
  return Array.from({ length: 8 }, (_, i) => ({
    channel_id: `UCcomp${i.toString().padStart(4, "0")}`,
    channel_title: ["TechBurner", "Phone Lab", "Gadget Guru", "Unbox Daily", "Tech Simplified", "Byte Size", "Spec Sheet", "Mobile Mantra"][i],
    subscriber_count: Math.floor(10_000 + r() * 3_000_000),
    niche: "Tech",
    sub_niche: "Smartphones",
    languages: "en",
    score: Math.round((0.95 - i * 0.07) * 100) / 100,
  }));
}

export function mockOptimizeVideos(): OptimizeVideo[] {
  const r = rng(5);
  return Array.from({ length: 10 }, (_, i) => ({
    id: `vid_own_${i}`,
    title: TITLE_TEMPLATES[i % TITLE_TEMPLATES.length].replace("{x}", TOPICS[(i * 3) % TOPICS.length]),
    thumbnail: "",
    publishedAt: new Date(Date.now() - i * 5 * 86400_000).toISOString(),
    viewCount: Math.floor(800 + r() * 40_000),
    titleScore: i === 0 ? null : Math.floor(35 + r() * 60),
    thumbnailScore: i === 0 ? null : Math.floor(30 + r() * 65),
    videoType: i % 4 === 3 ? "short" : "long",
  }));
}

export function mockCredits(): CreditBalance {
  const resets = new Date();
  resets.setMonth(resets.getMonth() + 1, 1);
  return {
    remainingQuota: { credits: 42, resets_at: resets.toISOString(), type: "monthly" },
    originalQuota: { credits: 50, type: "monthly" },
  };
}

export function mockConversations(): Conversation[] {
  return [
    {
      conversation_id: "conv_1",
      title: "Audit my channel",
      mode: "coach",
      channel_id: DEMO_CHANNEL_ID,
      message_count: 6,
      updated_at: new Date(Date.now() - 3600_000).toISOString(),
    },
    {
      conversation_id: "conv_2",
      title: "How do I get more views?",
      mode: "coach",
      channel_id: DEMO_CHANNEL_ID,
      message_count: 4,
      updated_at: new Date(Date.now() - 86400_000).toISOString(),
    },
  ];
}
