import { ApiError } from "@google/genai";
import { geminiEnabled } from "@/lib/coach";
import { scoreTitles } from "@/lib/title-score";

// POST { titles: string[] } -> { scores: { title, score, tip }[] }
export async function POST(req: Request) {
  if (!geminiEnabled()) {
    return Response.json(
      { error: "Title scoring needs GEMINI_API_KEY in .env.local (free key from aistudio.google.com/apikey)." },
      { status: 503 },
    );
  }
  const body = (await req.json().catch(() => null)) as { titles?: unknown } | null;
  const titles = Array.isArray(body?.titles)
    ? body.titles.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    : [];
  if (titles.length === 0 || titles.length > 20) {
    return Response.json({ error: "Send between 1 and 20 titles." }, { status: 400 });
  }

  try {
    return Response.json({ scores: await scoreTitles(titles) });
  } catch (err) {
    console.error(err);
    if (err instanceof ApiError && err.status === 429) {
      return Response.json({ error: "Free Gemini quota used up for now. Try again in a minute." }, { status: 429 });
    }
    return Response.json({ error: "Couldn't score the titles. Please try again." }, { status: 502 });
  }
}
