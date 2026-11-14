import { actOnCard } from "@/app/actions";
import { Badge, Button, Card, ConfidenceBadge, LinkButton } from "@/components/ui";
import type { FeedCard } from "./build";

function CardForm({ card, status, children }: { card: FeedCard; status: "saved" | "dismissed" | "none"; children: React.ReactNode }) {
  return (
    <form action={actOnCard}>
      <input type="hidden" name="key" value={card.key} />
      <input type="hidden" name="kind" value={card.kind} />
      <input type="hidden" name="title" value={card.title} />
      <input type="hidden" name="why" value={card.why} />
      <input type="hidden" name="href" value={card.action.href} />
      <input type="hidden" name="status" value={status} />
      {children}
    </form>
  );
}

export function FeedCardView({ card, saved }: { card: FeedCard; saved: boolean }) {
  return (
    <Card as="article" className="flex flex-col p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Badge tone={card.kind === "setup" ? "neutral" : "accent"}>{card.label}</Badge>
        {card.kind !== "setup" && <ConfidenceBadge level={card.confidence} note={card.confidenceNote} />}
      </div>
      <h3 className="text-base leading-snug font-semibold text-balance">{card.title}</h3>

      <p className="mt-3 text-[11px] font-medium tracking-wide text-faint uppercase">Why this matters</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{card.why}</p>

      {card.evidence.length > 0 && (
        <>
          <p className="mt-4 text-[11px] font-medium tracking-wide text-faint uppercase">Supporting data</p>
          <dl className="mt-1.5 divide-y divide-line/60 rounded-lg border border-line/60 bg-panel-2/50 text-sm">
            {card.evidence.map((e) => (
              <div key={e.label} className="flex items-baseline justify-between gap-4 px-3 py-2">
                <dt className="min-w-0 truncate text-muted">{e.label}</dt>
                <dd className="tabular shrink-0 text-right font-medium">{e.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-faint">{card.confidenceNote}</p>
        </>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-5">
        <LinkButton href={card.action.href} variant="primary" size="sm" icon="arrow">
          {card.action.label}
        </LinkButton>
        <div className="flex gap-1">
          <CardForm card={card} status={saved ? "none" : "saved"}>
            <Button variant="ghost" size="sm" aria-pressed={saved}>
              {saved ? "Saved ✓" : "Save"}
            </Button>
          </CardForm>
          <CardForm card={card} status="dismissed">
            <Button variant="ghost" size="sm">
              Dismiss
            </Button>
          </CardForm>
        </div>
      </div>
    </Card>
  );
}
