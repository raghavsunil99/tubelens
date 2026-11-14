import type { ReactNode } from "react";
import type { Problem } from "@/lib/result";
import { Card, LinkButton } from "./primitives";
import { ModeSwitchButton } from "../ModeSwitch";

export function EmptyState({ title, body, children }: { title: string; body?: ReactNode; children?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      {body && <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </Card>
  );
}

const TITLES: Record<Problem["kind"], string> = {
  disconnected: "Connect your channel to see this",
  no_channel: "No YouTube channel on this account",
  not_configured: "This server isn't set up for live data yet",
  quota: "YouTube's daily limit has been reached",
  rate_limited: "YouTube asked us to slow down",
  auth: "YouTube didn't accept the connection",
  not_found: "Not found on YouTube",
  error: "This couldn't be loaded",
};

/**
 * What a page shows in live mode when real data isn't available. It explains
 * why and offers the next step; it never substitutes demo numbers.
 */
export function ProblemState({ problem, retryHref }: { problem: Problem; retryHref?: string }) {
  const canConnect = problem.kind === "disconnected" || problem.kind === "auth" || problem.kind === "no_channel";
  return (
    <EmptyState title={TITLES[problem.kind]} body={problem.message}>
      {canConnect && (
        <LinkButton href="/api/auth/google" variant="primary">
          {problem.kind === "disconnected" ? "Connect YouTube" : "Reconnect YouTube"}
        </LinkButton>
      )}
      {(problem.kind === "error" || problem.kind === "rate_limited") && retryHref && (
        <LinkButton href={retryHref} variant="primary">
          Try again
        </LinkButton>
      )}
      {problem.kind === "not_configured" && (
        <LinkButton href="/settings" variant="primary">
          See what&apos;s missing
        </LinkButton>
      )}
      <ModeSwitchButton to="demo">Explore with demo data</ModeSwitchButton>
    </EmptyState>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="mt-6 h-56" />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    </div>
  );
}
