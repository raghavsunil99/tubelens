// Domain types shared by the data layer, API routes and pages.

export type CardType =
  | "video_idea"
  | "outlier_alert"
  | "title_boost"
  | "launch_window"
  | "competitor_move"
  | "keyword_trend";

export interface FeedCard {
  id: string;
  channelId: string;
  cardType: CardType;
  resourceId: string;
  resourceType: "video" | "keyword" | "channel" | "idea";
  status: "new" | "seen" | "saved" | "dismissed";
  cardData: {
    title: string;
    body: string;
    thumbnail?: string;
    metric?: { label: string; value: string };
  };
  llmData: { reasoning?: string; suggestedTitles?: string[] } | null;
  generationId: string;
  unlocksAt: string | null;
  createdAt: string;
}

export interface FeedInbox {
  channelId: string;
  cards: FeedCard[];
  pagination: { currentPage: number; pageSize: number; totalPages: number };
}

export interface ChannelStats {
  channelId: string;
  current: { viewCount: number; subscriberCount: number; videoCount: number };
  previous: { viewCount: number; subscriberCount: number; videoCount: number };
}

export interface VideoOutlier {
  video_id: string;
  video_title: string;
  video_published_at: number; // unix seconds
  video_duration: number; // seconds
  video_thumbnail: string;
  channel_id: string;
  channel_title: string;
  channel_country: string;
  channel_language: string;
  subscriber_count: number;
  main_category: string;
  view_count: number;
  avg_views: number;
  /** view_count / avg_views, computed server-side */
  outlier_score: number;
}

export interface ChannelSearchResult {
  channelId: string;
  channelTitle: string;
  handle: string;
  niche: string;
  nicheConfidence: number;
  mainCategory: string;
  country: string;
  languages: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  avgViews: number;
  estimatedEarnings: number;
  isFaceless: boolean | null;
  isPodcast: boolean | null;
}

export interface KeywordTrend {
  keyword: string;
  language: string;
  competition: number; // 0-100
  volume: number; // 0-100
  overall: number; // 0-100
  estimated_monthly_search: number;
  period_percent_change: number;
}

export interface Competitor {
  channel_id: string;
  channel_title: string;
  subscriber_count: number;
  niche: string;
  sub_niche: string;
  languages: string;
  score: number;
}

export interface OptimizeVideo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: number;
  titleScore: number | null;
  thumbnailScore: number | null;
  videoType: "long" | "short";
}

export interface CreditBalance {
  remainingQuota: { credits: number; resets_at: string; type: "monthly" };
  originalQuota: { credits: number; type: "monthly" };
}

export interface Conversation {
  conversation_id: string;
  title: string;
  mode: string;
  channel_id: string;
  message_count: number;
  updated_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
