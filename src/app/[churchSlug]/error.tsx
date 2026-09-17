"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/actions/observability";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
      <Card className="w-full max-w-sm rounded-3xl">
        <CardContent className="space-y-4 py-8 text-center">
          <h1 className="page-title text-lg">
            Ops, algo não carregou
          </h1>
          <p className="text-sm text-muted-foreground">
            Pode ter sido a conexão. Tente novamente — seus dados estão salvos.
          </p>
          <Button
            onClick={reset}
            className="h-12 w-full rounded-full text-base"
          >
            <RotateCcw className="size-4" />
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
