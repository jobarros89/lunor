"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/actions/observability";
import { ErrorState } from "@/components/shell/error-state";

/**
 * Boundary de erro raiz — cobre as rotas de entrada (login, cadastro,
 * onboarding, começar) que não têm um error.tsx próprio. Sem ele, um
 * crash nessas telas viraria tela branca sem saída.
 */
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
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <ErrorState reset={reset} />
    </div>
  );
}
