"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({ reset }: { reset: () => void }) {
  return (
    <section
      role="alert"
      className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 text-center shadow-[var(--shadow-surface)]"
    >
      <TriangleAlert
        className="mx-auto size-6 text-muted-foreground"
        aria-hidden="true"
      />
      <h1 className="text-xl font-semibold tracking-tight">
        Não foi possível carregar esta tela
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Confira sua conexão e tente novamente. Se o problema continuar, volte à
        página anterior.
      </p>
      <Button onClick={reset} className="w-full">
        <RotateCcw className="size-4" aria-hidden="true" />
        Tentar novamente
      </Button>
    </section>
  );
}
