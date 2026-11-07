import { PageHeader, Panel, SourceBadge } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getChannelStats, getFeedInbox } from "@/lib/data";
import { compact, timeAgo } from "@/lib/format";
import type { CardType } from "@/lib/types";

const CARD_LABEL: Record<CardType, { label: string; tone: string }> = {
  video_idea: { label: "Video idea", tone: "text-accent" },
  outlier_alert: { label: "Outlier alert", tone: "text-warn" },
  title_boost: { label: "Title boost", tone: "text-good" },
  launch_window: { label: "Launch window", tone: "text-accent" },
  competitor_move: { label: "Competitor", tone: "text-bad" },
  keyword_trend: { label: "Trending keyword", tone: "text-good" },
};

const AUTH_ERRORS: Record<string, string> = {
  not_configured: "YouTube sign-in isn't set up yet. Add the Google OAuth values to .env.local.",
  access_denied: "You cancelled the YouTube connection.",
  state_mismatch: "The sign-in link expired or was opened in another browser. Please try again.",
  youtube_scope_denied: "YouTube access wasn't granted, so we can't read your channel. Please allow it and try again.",
  token_exchange_failed: "Google sign-in failed. Check the server logs and your OAuth client settings.",
  no_channel: "Connected, but this Google account has no YouTube channel. Showing demo data.",
};

type SP = Promise<{ auth_error?: string }>;

export default async function FeedPage({ searchParams }: { searchParams: SP }) {
  const { auth_error } = await searchParams;
  const session = await getSession();
  const [{ source, data: stats }, inbox] = await Promise.all([
    getChannelStats(session),
    getFeedInbox(session?.channel?.id),
  ]);
  const delta = (k: "viewCount" | "subscriberCount" | "videoCount") => stats.current[k] - stats.previous[k];

  return (
    <div className="mx-auto max-w-5xl">
      {auth_error && (
        <div className="mb-6 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          {AUTH_ERRORS[auth_error] ?? `Sign-in error: ${auth_error}`}
        </div>
      )}
      <PageHeader
        title={session?.channel ? `${session.channel.title}'s feed` : "Your feed"}
        subtitle="Fresh ideas, alerts and fixes for your channel, generated daily."
      >
        <SourceBadge source={source} />
      </PageHeader>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            ["Subscribers", "subscriberCount"],
            ["Views", "viewCount"],
            ["Videos", "videoCount"],
          ] as const
        ).map(([label, key]) => (
          <Panel key={key} className="p-4">
            <div className="text-xs text-muted">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{compact(stats.current[key])}</div>
            <div className={`mt-1 text-xs ${delta(key) >= 0 ? "text-good" : "text-bad"}`}>
              {delta(key) >= 0 ? "+" : ""}
              {compact(delta(key))} {source === "youtube" ? "last 28 days" : "this period"}
            </div>
          </Panel>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {inbox.cards.map((card) => {
          const meta = CARD_LABEL[card.cardType];
          const locked = card.unlocksAt && new Date(card.unlocksAt).getTime() > Date.now();
          return (
            <Panel key={card.id} className={`flex flex-col p-5 ${locked ? "opacity-60" : ""}`}>
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className={`font-medium ${meta.tone}`}>{meta.label}</span>
                <span className="text-muted">{locked ? `Unlocks ${timeAgo(card.unlocksAt!)}` : timeAgo(card.createdAt)}</span>
              </div>
              <h2 className="text-base font-semibold">{card.cardData.title}</h2>
              <p className="mt-2 text-sm text-muted">{card.cardData.body}</p>
              {card.llmData?.suggestedTitles && (
                <ul className="mt-3 space-y-1 text-sm">
                  {card.llmData.suggestedTitles.map((t) => (
                    <li key={t} className="rounded-md bg-panel-2 px-3 py-1.5">
                      {t}
                    </li>
                  ))}
                </ul>
              )}
              {card.cardData.metric && (
                <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-sm">
                  <span className="text-muted">{card.cardData.metric.label}</span>
                  <span className="font-semibold">{card.cardData.metric.value}</span>
                </div>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
