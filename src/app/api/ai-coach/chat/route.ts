import { ApiError } from "@google/genai";
import { getSession } from "@/lib/auth";
import { sanitizeHistory, streamCoachReply } from "@/lib/coach";

// Streams the coach's reply as plain UTF-8 text (no JSON framing), so the
// client can append chunks as they arrive.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { messages?: unknown } | null;
  const history = sanitizeHistory(body?.messages);
  if (history.length === 0 || history.at(-1)?.role !== "user") {
    return Response.json({ error: "Send at least one user message." }, { status: 400 });
  }

  const session = await getSession();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const text of streamCoachReply(history, session)) {
          controller.enqueue(encoder.encode(text));
        }
      } catch (err) {
        console.error(err);
        let message = "Sorry, the coach couldn't answer right now. Please try again.";
        if (err instanceof ApiError) {
          if (err.status === 429) {
            message = "The free Gemini quota is used up for now. Wait a minute (or until tomorrow for the daily limit) and try again.";
          } else if (err.status === 400 || err.status === 401 || err.status === 403) {
            message = "Gemini rejected the request. Check GEMINI_API_KEY and GEMINI_MODEL in .env.local.";
          }
        }
        controller.enqueue(encoder.encode(message));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
