"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/actions/observability";
import { ErrorState } from "@/components/shell/error-state";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // persiste para a plataforma enxergar (best-effort, nunca lança)
    void reportError({
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <ErrorState reset={reset} />
    </div>
  );
}
