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
        body: "“5 ChatGPT Tricks 99% of People Don't Know” is at 11.2x its channel average after 4 days.",
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

// Curated demo outliers: titles and channels that belong together.
const DEMO_OUTLIERS: { title: string; channel: string; niche: string; short?: boolean }[] = [
  { title: "I Tested 9 Budget Phones So You Don't Have To", channel: "Phone Lab", niche: "Tech" },
  { title: "5 ChatGPT Tricks 99% of People Don't Know", channel: "AI Simplified", niche: "Tech" },
  { title: "Why Your SIP Isn't Making Money", channel: "Money Matters", niche: "Personal Finance" },
  { title: "Hyderabadi Biryani in 30 Minutes", channel: "Spice Route Kitchen", niche: "Cooking" },
  { title: "This Phone Camera Beat a ₹1 Lakh DSLR", channel: "Phone Lab", niche: "Tech", short: true },
  { title: "I Survived 100 Days in Hardcore Minecraft", channel: "BlockCraft", niche: "Gaming" },
  { title: "What Happens Inside a Black Hole?", channel: "Cosmos Explained", niche: "Education" },
  { title: "20-Minute Home Workout, No Equipment", channel: "FitAtHome", niche: "Fitness" },
  { title: "₹10,000 to ₹1 Lakh: My Honest Plan", channel: "Money Matters", niche: "Personal Finance" },
  { title: "The AI Tool That Replaced My Editor", channel: "Creator Stack", niche: "Tech" },
  { title: "Street Food Tour: Old Delhi at Midnight", channel: "Spice Route Kitchen", niche: "Cooking" },
  { title: "Speedrunning Minecraft With One Hand", channel: "BlockCraft", niche: "Gaming", short: true },
  { title: "Laptop Under ₹50,000? Watch This First", channel: "Gadget Guru", niche: "Tech" },
  { title: "Why Is the Sky Blue? (In 60 Seconds)", channel: "Cosmos Explained", niche: "Education", short: true },
  { title: "I Did 100 Push-Ups Every Day for 30 Days", channel: "FitAtHome", niche: "Fitness" },
  { title: "Index Funds Explained in 8 Minutes", channel: "Money Matters", niche: "Personal Finance" },
  { title: "iPhone vs Android: My Honest Switch Story", channel: "Gadget Guru", niche: "Tech" },
  { title: "One-Pot Meal Prep for the Whole Week", channel: "Spice Route Kitchen", niche: "Cooking" },
  { title: "Building a Working Calculator in Redstone", channel: "BlockCraft", niche: "Gaming" },
  { title: "The Side Hustle Nobody Talks About", channel: "Creator Stack", niche: "Personal Finance" },
  { title: "Earth From the Moon: Real Footage Explained", channel: "Cosmos Explained", niche: "Education" },
  { title: "Fix Your Posture in 5 Minutes a Day", channel: "FitAtHome", niche: "Fitness", short: true },
  { title: "Unboxing the Cheapest 5G Phone in India", channel: "Phone Lab", niche: "Tech", short: true },
  { title: "How I Edit YouTube Videos 3x Faster", channel: "Creator Stack", niche: "Tech" },
];

export function mockOutliers(): VideoOutlier[] {
  const r = rng(42);
  const channelSubs = new Map<string, number>();
  const out = DEMO_OUTLIERS.map((d, i) => {
    if (!channelSubs.has(d.channel)) channelSubs.set(d.channel, Math.floor(20_000 + r() * 900_000));
    const subs = channelSubs.get(d.channel)!;
    const avg = Math.max(800, Math.floor(subs * (0.08 + r() * 0.25)));
    const score = 2 + r() * r() * 22;
    const views = Math.floor(avg * score);
    return {
      video_id: `vid_outlier_${i}`,
      video_title: d.title,
      video_published_at: Math.floor(Date.now() / 1000 - (2 + r() * 50) * 86400),
      video_duration: d.short ? Math.floor(20 + r() * 40) : Math.floor(360 + r() * 1200),
      video_thumbnail: "",
      channel_id: `UCmock${i.toString().padStart(4, "0")}`,
      channel_title: d.channel,
      channel_country: "IN",
      channel_language: "en",
      subscriber_count: subs,
      main_category: d.niche,
      view_count: views,
      avg_views: avg,
      outlier_score: Math.round((views / avg) * 10) / 10,
    };
  });
  return out.sort((a, b) => b.outlier_score - a.outlier_score);
}

const DEMO_CHANNELS: { title: string; handle: string; niche: string; faceless?: boolean; podcast?: boolean }[] = [
  { title: "Phone Lab", handle: "@phonelab", niche: "Tech" },
  { title: "Money Matters", handle: "@moneymatters", niche: "Personal Finance" },
  { title: "Spice Route Kitchen", handle: "@spiceroute", niche: "Cooking" },
  { title: "BlockCraft", handle: "@blockcraft", niche: "Gaming", faceless: true },
  { title: "Cosmos Explained", handle: "@cosmosexplained", niche: "Education", faceless: true },
  { title: "FitAtHome", handle: "@fitathome", niche: "Fitness" },
  { title: "AI Simplified", handle: "@aisimplified", niche: "Tech", faceless: true },
  { title: "The Creator Talk", handle: "@creatortalk", niche: "Education", podcast: true },
  { title: "Gadget Guru", handle: "@gadgetguru", niche: "Tech" },
  { title: "Creator Stack", handle: "@creatorstack", niche: "Tech" },
  { title: "Desi Money Podcast", handle: "@desimoney", niche: "Personal Finance", podcast: true },
  { title: "Street Eats India", handle: "@streeteats", niche: "Cooking" },
];

export function mockChannelSearch(): ChannelSearchResult[] {
  const r = rng(7);
  return DEMO_CHANNELS.map((c, i) => {
    const subs = Math.floor(15_000 + r() * 1_800_000);
    const videos = Math.floor(40 + r() * 600);
    const avgViews = Math.floor(subs * (0.05 + r() * 0.3));
    return {
      channelId: `UCsearch${i.toString().padStart(4, "0")}`,
      channelTitle: c.title,
      handle: c.handle,
      niche: c.niche,
      nicheConfidence: Math.round((0.7 + r() * 0.3) * 100) / 100,
      mainCategory: c.niche,
      country: "IN",
      languages: "en",
      subscriberCount: subs,
      viewCount: avgViews * videos,
      videoCount: videos,
      avgViews,
      estimatedEarnings: Math.floor(avgViews * videos * 0.0015),
      isFaceless: c.faceless ?? false,
      isPodcast: c.podcast ?? false,
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

const DEMO_UPLOADS = [
  "The Phone I'd Buy With My Own Money in 2026",
  "Budget Phones Ranked: Every Model Under ₹15k",
  "My Honest Review After 30 Days",
  "Top 5 Earbuds Under ₹2,000",
  "Don't Buy a Smartwatch Before Watching This",
  "This ₹999 Gadget Surprised Me",
  "Phone Camera Settings Nobody Uses",
  "Battery Test: 5 Phones, 1 Day",
  "Is 5G Worth It Yet?",
  "Unboxing: The Tiniest Projector",
];

export function mockOptimizeVideos(): OptimizeVideo[] {
  const r = rng(5);
  return DEMO_UPLOADS.map((title, i) => ({
    id: `vid_own_${i}`,
    title,
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
