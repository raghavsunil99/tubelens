"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-md rounded-xl border border-line bg-panel px-6 py-12 text-center">
      <h1 className="text-base font-semibold">This page hit a problem</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Nothing was changed on your channel. TubeLens only ever reads from YouTube. Try again, and if it keeps happening, check the server log.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-faint">Reference: {error.digest}</p>}
      <button onClick={reset} className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">
        Try again
      </button>
    </div>
  );
}
