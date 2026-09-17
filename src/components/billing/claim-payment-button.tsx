"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { claimPayment } from "@/lib/actions/billing";

export function ClaimPaymentButton({
  churchSlug,
  churchId,
}: {
  churchSlug: string;
  churchId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [avisado, setAvisado] = useState(false);

  if (avisado) {
    return (
      <p className="text-sm text-muted-foreground">
        Aviso enviado. Assim que o pagamento for conferido, a data de validade
        é atualizada aqui.
      </p>
    );
  }

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await claimPayment({ churchSlug, churchId, note: "" });
          if (r.ok) {
            setAvisado(true);
            toast.success("Obrigado! Vamos conferir e liberar.");
          } else {
            toast.error(r.error);
          }
        })
      }
    >
      {pending ? "Enviando…" : "Já paguei"}
    </Button>
  );
}
