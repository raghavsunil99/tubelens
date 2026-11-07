import { Sidebar } from "@/components/Sidebar";
import { getSession } from "@/lib/auth";
import { getCredits } from "@/lib/data";
import { oauthConfigured } from "@/lib/session";

// Feed timestamps, credits and channel stats are per-request data.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [credits, session] = await Promise.all([getCredits(), getSession()]);
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar
        credits={{ remaining: credits.remainingQuota.credits, total: credits.originalQuota.credits }}
        account={
          session
            ? {
                name: session.channel?.title ?? session.user.name ?? session.user.email ?? "Signed in",
                thumbnail: session.channel?.thumbnail,
                hasChannel: Boolean(session.channel),
              }
            : null
        }
        oauthReady={oauthConfigured()}
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
