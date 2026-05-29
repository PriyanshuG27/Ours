"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report to Sentry — beforeSend hook will scrub any PII before transmission
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-lg font-semibold text-white">Something went wrong</h1>
          <p className="text-sm text-zinc-400">
            An unexpected error occurred. This has been reported and we&apos;ll look into it.
          </p>
          <button
            onClick={reset}
            className="w-full py-3 rounded-xl bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
