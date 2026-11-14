import { quotaStatus } from "@/lib/quota";

// TubeLens's own estimate of YouTube Data API units used today.
export async function GET() {
  return Response.json({ ...quotaStatus(), estimated: true });
}
