"use client";

import { useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";

const STARTERS = ["Audit my channel", "Give me video ideas", "Find keyword opportunities"];

/** Renders the **bold** and *italic* markdown the model uses, as React nodes (no raw HTML). */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function CoachChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    let reply = "";
    const show = (text: string) => setMessages([...next, { role: "assistant", content: text }]);
    try {
      const res = await fetch("/api/ai-coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) throw new Error(`Coach request failed (${res.status})`);
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
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-line bg-panel">
      <div className="min-h-[360px] flex-1 space-y-4 p-5">
        {messages.length === 0 && (
          <div className="flex h-[320px] flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-muted">Start with one of these:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-line px-4 py-2 text-sm hover:border-accent hover:text-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-accent text-white" : "bg-panel-2"
              }`}
            >
              {m.role === "assistant" ? renderInline(m.content.replace(/^(\s*)[-*] /gm, "$1• ")) : m.content}
            </div>
          </div>
        ))}
        {busy && messages.at(-1)?.role === "user" && <div className="text-sm text-muted">Coach is thinking…</div>}
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
          placeholder="Ask your coach…"
          className="min-w-0 flex-1 rounded-lg bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-muted"
        />
        <button
          disabled={busy || !input.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
