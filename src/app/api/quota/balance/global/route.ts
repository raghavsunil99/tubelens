import { getCredits } from "@/lib/data";

export async function GET() {
  return Response.json(await getCredits());
}
