import { PageHeader } from "@/components/ui";
import { getConversations } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { CoachChat } from "./CoachChat";

export default async function AiCoachPage() {
  const conversations = await getConversations();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:flex-row">
      <div className="min-w-0 flex-1">
        <PageHeader title="AI Coach" subtitle="Ask anything about growing your channel. Answers use your channel data." />
        <CoachChat />
      </div>
      <aside className="w-full shrink-0 lg:w-64 lg:pt-16">
        <div className="mb-2 text-xs font-medium text-muted">Recent chats</div>
        <ul className="space-y-1">
          {conversations.map((c) => (
            <li key={c.conversation_id} className="rounded-lg px-3 py-2 text-sm hover:bg-panel">
              <div className="truncate">{c.title}</div>
              <div className="text-xs text-muted">
                {c.message_count} messages · {timeAgo(c.updated_at)}
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
