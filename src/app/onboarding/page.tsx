import Link from "next/link";
import { redirect } from "next/navigation";
import { savePreferences } from "@/app/actions";
import { ModeSwitchButton } from "@/components/ModeSwitch";
import { Badge, Button, Card, ConfidenceBadge, inputClass, LinkButton, SourceBadge } from "@/components/ui";
import { getFeed } from "@/features/feed/data";
import { GOALS, LANGUAGES, NICHE_EXAMPLES } from "@/features/onboarding/options";
import { compact } from "@/lib/format";
import { getViewer } from "@/lib/viewer";
import { TimezoneField } from "./TimezoneField";

export const dynamic = "force-dynamic";

const STEPS = ["Connect YouTube", "Your channel", "Niche & language", "Growth goal", "First recommendations"];

type SP = Promise<{ step?: string }>;

export default async function OnboardingPage({ searchParams }: { searchParams: SP }) {
  const viewer = await getViewer();
  const requested = Number((await searchParams).step);
  const connected = Boolean(viewer.session?.channel);
  const demo = viewer.mode === "demo";
  // Steps 1 and 2 are about the connection; skip ahead if that's settled.
  let step = requested >= 1 && requested <= 5 ? requested : connected || demo ? 2 : 1;
  if (step >= 2 && !connected && !demo) step = 1;
  if (step === 5 && !viewer.prefs.onboardedAt) redirect("/onboarding?step=3");

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 md:py-16">
      <div className="mb-8 flex items-center justify-between">
        <span className="text-base font-semibold tracking-tight">TubeLens</span>
        <Link href="/feed" className="text-sm text-muted hover:text-text">Skip for now</Link>
      </div>

      <ol className="mb-8 flex gap-1.5" aria-label="Setup progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1" aria-current={i + 1 === step ? "step" : undefined}>
            <div className={`h-1 rounded-full ${i + 1 <= step ? "bg-accent" : "bg-panel-3"}`} />
            <span className={`mt-2 hidden text-[11px] sm:block ${i + 1 === step ? "text-text" : "text-faint"}`}>{label}</span>
          </li>
        ))}
      </ol>
      <p className="mb-2 text-xs text-muted">Step {step} of 5</p>

      {step === 1 && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Connect your YouTube channel</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">TubeLens reads your channel&apos;s numbers to tell you what to do next. It is read-only: it can never upload, edit, delete or comment.</p>
          <Card className="mt-6 space-y-3 p-5 text-sm">
            {[
              ["It can see", "Your channel details, video list, views, watch time and subscriber changes."],
              ["It can't do", "Anything that changes your channel. Google enforces this, not just TubeLens."],
              ["You stay in control", "Disconnect any time from Privacy & settings; access is revoked with Google straight away."],
            ].map(([t, d]) => (
              <div key={t} className="grid gap-1 sm:grid-cols-[9rem_1fr]">
                <span className="font-medium">{t}</span>
                <span className="leading-relaxed text-muted">{d}</span>
              </div>
            ))}
          </Card>
          <div className="mt-6 flex flex-wrap gap-3">
            {viewer.oauthReady ? (
              <LinkButton href="/api/auth/google" variant="primary">Connect YouTube</LinkButton>
            ) : (
              <p className="w-full rounded-lg border border-dashed border-line p-3 text-sm text-muted">Google sign-in isn&apos;t configured on this server yet, so only demo data is available. See <Link className="text-accent-soft underline" href="/settings">Privacy &amp; settings</Link>.</p>
            )}
            <ModeSwitchButton to="demo">Look around with demo data first</ModeSwitchButton>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">{demo ? "You're exploring the demo channel" : "Is this the right channel?"}</h1>
          <Card className="mt-6 flex items-center gap-4 p-5">
            {viewer.session?.channel?.thumbnail && !demo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewer.session.channel.thumbnail} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-full bg-panel-3 text-lg font-semibold">{demo ? "D" : viewer.session?.channel?.title[0]}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{demo ? "Phone Lab (demo channel)" : viewer.session?.channel?.title}</div>
              <div className="mt-1">{demo ? <SourceBadge source="demo" /> : <Badge tone="good">Connected · read-only</Badge>}</div>
            </div>
          </Card>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {demo
              ? "Everything you see will be made-up example data. You can connect your real channel at any time from the sidebar."
              : "Google connects the channel you picked on its sign-in screen. If you manage several channels and this is the wrong one, connect again and choose the other."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton href="/onboarding?step=3" variant="primary" icon="arrow">{demo ? "Continue" : "Yes, continue"}</LinkButton>
            {!demo && <LinkButton href="/api/auth/google">Choose a different channel</LinkButton>}
            {demo && viewer.oauthReady && <LinkButton href="/api/auth/google">Connect my channel instead</LinkButton>}
          </div>
        </>
      )}

      {step === 3 && (
        <form action={savePreferences}>
          <input type="hidden" name="step" value="3" />
          <TimezoneField />
          <h1 className="text-2xl font-semibold tracking-tight">What do you make videos about?</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">A few words is enough. TubeLens uses this to look for breakout videos and keywords in your space.</p>
          <label className="mt-6 block text-xs font-medium text-muted" htmlFor="niche">Your niche</label>
          <input id="niche" name="niche" required maxLength={80} defaultValue={viewer.prefs.niche ?? ""} placeholder="e.g. budget phones" list="niches" className={`${inputClass} mt-1.5 w-full`} />
          <datalist id="niches">{NICHE_EXAMPLES.map((n) => <option key={n} value={n} />)}</datalist>
          <fieldset className="mt-6">
            <legend className="text-xs font-medium text-muted">Main language of your videos</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {LANGUAGES.map(([code, name]) => (
                <label key={code} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm has-checked:border-accent has-checked:bg-accent/10">
                  <input type="radio" name="language" value={code} required defaultChecked={(viewer.prefs.language ?? "te") === code} className="accent-(--accent)" />
                  {name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-8"><Button variant="primary" icon="arrow">Continue</Button></div>
        </form>
      )}

      {step === 4 && (
        <form action={savePreferences}>
          <input type="hidden" name="step" value="4" />
          <h1 className="text-2xl font-semibold tracking-tight">What are you working towards?</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">Pick the one that matters most right now. The Coach keeps it in mind.</p>
          <div className="mt-6 space-y-2">
            {GOALS.map((g, i) => (
              <label key={g} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3 text-sm has-checked:border-accent has-checked:bg-accent/10">
                <input type="radio" name="goal" value={g} required defaultChecked={viewer.prefs.goal ? viewer.prefs.goal === g : i === 1} className="accent-(--accent)" />
                {g}
              </label>
            ))}
          </div>
          <div className="mt-8 flex gap-3">
            <Button variant="primary" icon="arrow">See my recommendations</Button>
            <LinkButton href="/onboarding?step=3" variant="ghost">Back</LinkButton>
          </div>
        </form>
      )}

      {step === 5 && <FirstRecommendations />}
    </main>
  );
}

async function FirstRecommendations() {
  const viewer = await getViewer();
  const result = await getFeed(viewer);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">You&apos;re set. Here&apos;s where to start.</h1>
      {!result.ok ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">{result.problem.message} Your preferences are saved; recommendations will appear on your feed once your channel data loads.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
            <SourceBadge source={result.source} />
            {result.data.overview.channel.title} · {result.data.overview.channel.subscribers === null ? "subscribers hidden" : `${compact(result.data.overview.channel.subscribers)} subscribers`}
          </div>
          <ul className="mt-6 space-y-3">
            {result.data.feed.cards.slice(0, 3).map((c) => (
              <Card as="li" key={c.key} className="p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Badge tone={c.kind === "setup" ? "neutral" : "accent"}>{c.label}</Badge>
                  {c.kind !== "setup" && <ConfidenceBadge level={c.confidence} note={c.confidenceNote} />}
                </div>
                <h2 className="text-sm leading-snug font-semibold">{c.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{c.today}</p>
              </Card>
            ))}
          </ul>
        </>
      )}
      <div className="mt-8"><LinkButton href="/feed" variant="primary" icon="arrow">Go to my feed</LinkButton></div>
    </>
  );
}
