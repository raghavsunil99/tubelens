import "server-only";

// Single data layer used by both the API routes and the server-rendered pages.
// Each function prefers live YouTube data when YOUTUBE_API_KEY is set and falls
// back to deterministic mock data otherwise. `source` tells the UI which it got.
import {
  DEMO_CHANNEL_ID,
  mockChannelSearch,
  mockChannelStats,
  mockCompetitors,
  mockConversations,
  mockCredits,
  mockFeed,
  mockKeywordTrends,
  mockOptimizeVideos,
  mockOutliers,
} from "./mock-data";
import type { Session } from "./session";
import type { ChannelSearchResult, ChannelStats, OptimizeVideo, VideoOutlier } from "./types";
import { parseDuration, searchChannels, searchVideosWithChannelAverages } from "./youtube";
import { getMyChannel, getMyChannelStats, getMyRecentUploads } from "./youtube-user";

export type Sourced<T> = { source: "youtube" | "mock"; data: T };

export async function getFeedInbox(channelId = DEMO_CHANNEL_ID) {
  // TODO: replace with a nightly per-channel "generation" job that writes cards.
  return {
    channelId,
    cards: mockFeed(channelId),
    pagination: { currentPage: 1, pageSize: 20, totalPages: 1 },
  };
}

export async function getChannelStats(session?: Session | null): Promise<Sourced<ChannelStats>> {
  if (session?.channel) {
    try {
      const channel = await getMyChannel(session.accessToken);
      if (channel) return { source: "youtube", data: await getMyChannelStats(session.accessToken, channel) };
    } catch (err) {
      console.error(err);
    }
  }
  return { source: "mock", data: mockChannelStats() };
}

export async function getOutliers(opts: {
  q?: string;
  videoType?: "long" | "short" | "all";
  minScore?: number;
}): Promise<Sourced<VideoOutlier[]>> {
  const { q, videoType = "all", minScore = 1 } = opts;
  let rows: VideoOutlier[] | null = null;
  let source: "youtube" | "mock" = "mock";

  if (q) {
    try {
      const live = await searchVideosWithChannelAverages(q);
      if (live) {
        source = "youtube";
        rows = live.map(({ video, channel }) => {
          const views = Number(video.statistics.viewCount ?? 0);
          const chViews = Number(channel?.statistics.viewCount ?? 0);
          const chVideos = Math.max(1, Number(channel?.statistics.videoCount ?? 1));
          // Lifetime average is a rough stand-in for vidIQ's avg_views; a real
          // build should use the median of the channel's recent uploads.
          const avg = Math.max(1, Math.round(chViews / chVideos));
          return {
            video_id: video.id,
            video_title: video.snippet.title,
            video_published_at: Math.floor(new Date(video.snippet.publishedAt).getTime() / 1000),
            video_duration: parseDuration(video.contentDetails.duration),
            video_thumbnail: video.snippet.thumbnails.medium?.url ?? "",
            channel_id: video.snippet.channelId,
            channel_title: video.snippet.channelTitle,
            channel_country: channel?.snippet.country ?? "",
            channel_language: video.snippet.defaultAudioLanguage ?? "",
            subscriber_count: Number(channel?.statistics.subscriberCount ?? 0),
            main_category: video.snippet.categoryId,
            view_count: views,
            avg_views: avg,
            outlier_score: Math.round((views / avg) * 10) / 10,
          };
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (!rows) {
    rows = mockOutliers();
    if (q) {
      const needle = q.toLowerCase();
      const filtered = rows.filter(
        (r) =>
          r.video_title.toLowerCase().includes(needle) ||
          r.main_category.toLowerCase().includes(needle),
      );
      if (filtered.length) rows = filtered;
    }
  }

  rows = rows
    .filter((r) => r.outlier_score >= minScore)
    .filter((r) =>
      videoType === "all" ? true : videoType === "short" ? r.video_duration <= 60 : r.video_duration > 60,
    )
    .sort((a, b) => b.outlier_score - a.outlier_score);

  return { source, data: rows };
}

export async function searchChannelDirectory(q?: string): Promise<Sourced<ChannelSearchResult[]>> {
  if (q) {
    try {
      const live = await searchChannels(q);
      if (live) {
        return {
          source: "youtube",
          data: live.map((c) => {
            const views = Number(c.statistics.viewCount);
            const videos = Math.max(1, Number(c.statistics.videoCount));
            return {
              channelId: c.id,
              channelTitle: c.snippet.title,
              handle: c.snippet.customUrl ?? "",
              // niche / faceless / podcast need an LLM classification step.
              niche: "Unclassified",
              nicheConfidence: 0,
              mainCategory: "",
              country: c.snippet.country ?? "",
              languages: c.snippet.defaultLanguage ?? "",
              subscriberCount: Number(c.statistics.subscriberCount ?? 0),
              viewCount: views,
              videoCount: videos,
              avgViews: Math.round(views / videos),
              // Rough RPM assumption of $1.50 per 1k views.
              estimatedEarnings: Math.round(views * 0.0015),
              isFaceless: null,
              isPodcast: null,
            };
          }),
        };
      }
    } catch (err) {
      console.error(err);
    }
  }
  let data = mockChannelSearch();
  if (q) {
    const needle = q.toLowerCase();
    const f = data.filter(
      (c) => c.channelTitle.toLowerCase().includes(needle) || c.niche.toLowerCase().includes(needle),
    );
    if (f.length) data = f;
  }
  return { source: "mock", data };
}

export async function getKeywordTrends(topic?: string) {
  // No public API exposes YouTube search volume; this needs your own source
  // (autocomplete sampling, Google Trends, or a paid keyword dataset).
  return mockKeywordTrends(topic);
}

export async function getCompetitors() {
  return mockCompetitors();
}

export async function getOptimizeVideos(session?: Session | null): Promise<Sourced<OptimizeVideo[]>> {
  if (session?.channel) {
    try {
      const channel = await getMyChannel(session.accessToken);
      if (channel) return { source: "youtube", data: await getMyRecentUploads(session.accessToken, channel) };
    } catch (err) {
      console.error(err);
    }
  }
  return { source: "mock", data: mockOptimizeVideos() };
}

export async function getCredits() {
  return mockCredits();
}

export async function getConversations() {
  return mockConversations();
}
