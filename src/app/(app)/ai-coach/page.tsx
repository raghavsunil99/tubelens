import Link from "next/link";
import { PageHeader, SourceBadge } from "@/components/ui";
import { geminiEnabled, listConversations, loadConversation, QUICK_PROMPTS } from "@/features/coach/coach";
import { timeAgo } from "@/lib/format";
import { getViewer } from "@/lib/viewer";
import { CoachChat } from "./CoachChat";

type SP = Promise<{ prompt?: string; c?: string }>;

export default async function AiCoachPage({ searchParams }: { searchParams: SP }) {
  const { prompt, c } = await searchParams;
  const viewer = await getViewer();
  const conversations = listConversations(viewer);
  const loaded = c ? loadConversation(viewer, c) : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row">
      <div className="min-w-0 flex-1">
        <PageHeader title="AI Coach" subtitle="Answers are built from your channel's data and say which data they used. The Coach never guesses numbers it doesn't have.">
          {viewer.mode === "demo" ? <SourceBadge source="demo" /> : viewer.channelId ? <SourceBadge source="youtube" /> : null}
        </PageHeader>
        {!geminiEnabled() && (
          <p className="mb-4 rounded-lg border border-line bg-panel-2 px-4 py-2.5 text-sm text-muted">
            Basic mode: no AI model is configured on this server, so answers are assembled from your data by fixed rules. Add GEMINI_API_KEY for full coaching.
          </p>
        )}
        <CoachChat
          key={c ?? "new"}
          quickPrompts={QUICK_PROMPTS}
          initialMessages={loaded ?? []}
          initialConversationId={loaded ? c! : null}
          initialPrompt={(prompt ?? "").slice(0, 500)}
        />
        <p className="mt-3 text-xs leading-relaxed text-faint">
          {geminiEnabled()
            ? "When you send a question, a summary of your channel's numbers and recent video titles is sent to Google Gemini to write the answer."
            : "In basic mode nothing leaves this server."}{" "}
          The Coach has no access to click-through rate, impressions, revenue or audience demographics.
        </p>
      </div>
      <aside className="w-full shrink-0 lg:w-60 lg:pt-20">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted">
          Your conversations
          <Link href="/ai-coach" className="text-accent-soft hover:underline">New</Link>
        </div>
        {conversations.length === 0 ? (
          <p className="text-xs leading-relaxed text-faint">Conversations you have with the Coach are kept here.</p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <Link href={`/ai-coach?c=${conv.id}`} className={`block rounded-lg px-3 py-2 text-sm hover:bg-panel ${conv.id === c ? "bg-panel" : ""}`}>
                  <div className="truncate">{conv.title}</div>
                  <div className="text-xs text-muted">{conv.messages} messages · {timeAgo(`${conv.updated_at.replace(" ", "T")}Z`)}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
