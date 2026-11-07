import { searchChannelDirectory } from "@/lib/data";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { query?: string };
  const { source, data } = await searchChannelDirectory(body.query);
  return Response.json({ source, results: data });
}
