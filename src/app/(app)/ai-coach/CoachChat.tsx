"use client";

import { useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  /** Evidence sections the answer was grounded in, from the response headers. */
  sections?: string[];
  source?: string;
}

/** Renders the **bold** and *italic* markdown the model uses, as React nodes (no raw HTML). */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i} className="text-text">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

const tidy = (s: string) => s.replace(/^#{1,4}\s+/gm, "").replace(/^(\s*)[-*] /gm, "$1• ");

export function CoachChat({
  quickPrompts,
  initialMessages,
  initialConversationId,
  initialPrompt,
}: {
  quickPrompts: string[];
  initialMessages: Message[];
  initialConversationId: string | null;
  initialPrompt: string;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState(initialPrompt);
  const [busy, setBusy] = useState(false);
  const conversationId = useRef(initialConversationId);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    let reply = "";
    let meta: Pick<Message, "sections" | "source"> = {};
    const show = (t: string) => setMessages([...next, { role: "assistant", content: t, ...meta }]);
    try {
      const res = await fetch("/api/ai-coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })), conversationId: conversationId.current }),
      });
      if (!res.ok || !res.body) throw new Error(`Coach request failed (${res.status})`);
      conversationId.current = res.headers.get("X-Conversation-Id") ?? conversationId.current;
      meta = {
        sections: (res.headers.get("X-Data-Sections") ?? "").split(",").filter(Boolean),
        source: res.headers.get("X-Data-Source") ?? undefined,
      };
      // The reply streams as plain text; append each chunk as it arrives.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        show(reply);
        endRef.current?.scrollIntoView({ block: "end" });
      }
      reply += decoder.decode();
      show(reply || "Sorry, I didn't get an answer. Please try again.");
    } catch (err) {
      show(`${reply}${reply ? "\n\n" : ""}Sorry, something went wrong: ${(err as Error).message}`);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-line bg-panel">
      <div className="min-h-[360px] flex-1 space-y-4 p-4 md:p-5" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex min-h-[320px] flex-col justify-center gap-4">
            <p className="text-sm text-muted">Start with a question:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {quickPrompts.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border border-line bg-panel-2/60 px-4 py-3 text-left text-sm transition-colors hover:border-accent hover:bg-panel-2"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap md:max-w-[85%] ${m.role === "user" ? "bg-accent text-white" : "bg-panel-2 text-text/90"}`}>
              {m.role === "assistant" ? renderInline(tidy(m.content)) : m.content}
              {m.role === "assistant" && m.sections && (
                <div className="mt-3 border-t border-line pt-2 text-[11px] leading-relaxed text-faint">
                  {m.source === "none"
                    ? "No channel data was available for this answer."
                    : `Data used${m.source === "demo" ? " (demo)" : ""}: ${m.sections.map((s) => s.toLowerCase()).join(", ")}`}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && messages.at(-1)?.role === "user" && <div className="text-sm text-muted">Reading your channel data…</div>}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-line p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask in English, Telugu or Tenglish…"
          aria-label="Message the coach"
          className="min-w-0 flex-1 rounded-lg bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:ring-1 focus:ring-accent"
        />
        <button disabled={busy || !input.trim()} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
          Send
        </button>
      </form>
    </div>
  );
}
