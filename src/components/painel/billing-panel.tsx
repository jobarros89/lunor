"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { confirmPayment, exemptChurch } from "@/lib/actions/billing";
import { BILLING_LABEL, diasRestantes, type BillingStatus } from "@/lib/billing";

export type BillingChurch = {
  id: string;
  name: string;
  status: BillingStatus;
  paidUntil: string | null;
  avisouPagamento: boolean;
};

export function BillingPanel({ churches }: { churches: BillingChurch[] }) {
  const [pending, startTransition] = useTransition();

  const cor = (s: BillingStatus) =>
    s === "isenta" || s === "ativa"
      ? "bg-emerald-100 text-emerald-800"
      : s === "trial"
        ? "bg-sky-100 text-sky-800"
        : "bg-amber-100 text-amber-800";

  return (
    <div className="space-y-2">
      {churches.map((c) => {
        const dias = diasRestantes(c.paidUntil);
        return (
          <div
            key={c.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 truncate font-medium">
                {c.name}
                {c.avisouPagamento && (
                  <Badge className="border-0 bg-purple-100 text-purple-800">
                    avisou que pagou
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {BILLING_LABEL[c.status]}
                {c.status !== "isenta" && dias !== null
                  ? dias >= 0
                    ? ` · ${dias}d restantes`
                    : ` · vencido há ${Math.abs(dias)}d`
                  : ""}
              </p>
            </div>
            <Badge className={`rounded-full border-0 ${cor(c.status)}`}>
              {BILLING_LABEL[c.status]}
            </Badge>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await confirmPayment(c.id, 1);
                    toast[r.ok ? "success" : "error"](
                      r.ok ? `${c.name}: +1 mês` : r.error
                    );
                  })
                }
              >
                +1 mês
              </Button>
              {c.status !== "isenta" && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await exemptChurch(c.id);
                      toast[r.ok ? "success" : "error"](
                        r.ok ? `${c.name}: isenta` : r.error
                      );
                    })
                  }
                >
                  Isentar
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {churches.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma igreja ainda.</p>
      )}
    </div>
  );
}
