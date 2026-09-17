import { redirect } from "next/navigation";
import { HeartHandshake } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import {
  BILLING_LABEL,
  DIAS_TRIAL,
  PRECO_ANUAL,
  PRECO_MENSAL,
  diasRestantes,
  type BillingStatus,
} from "@/lib/billing";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClaimPaymentButton } from "@/components/billing/claim-payment-button";

export default async function AssinaturaPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  if (!tenant.isCoord) redirect(`/${churchSlug}`);

  const supabase = await createClient();
  const { data: church } = await supabase
    .from("churches")
    .select("billing_status, paid_until, billing_note")
    .eq("id", tenant.church.id)
    .single();

  const status = (church?.billing_status ?? "trial") as BillingStatus;
  const dias = diasRestantes(church?.paid_until ?? null);
  const pixKey = process.env.NEXT_PUBLIC_PIX_KEY;
  const pixNome = process.env.NEXT_PUBLIC_PIX_NOME;

  const corStatus =
    status === "isenta" || status === "ativa"
      ? "bg-emerald-100 text-emerald-800"
      : status === "trial"
        ? "bg-sky-100 text-sky-800"
        : "bg-amber-100 text-amber-800";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title ">Assinatura</h1>
        <p className="text-muted-foreground">{tenant.church.name}</p>
      </div>

      <Card className="rounded-3xl">
        <CardContent className="space-y-3 py-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className={`rounded-full border-0 ${corStatus}`}>
              {BILLING_LABEL[status]}
            </Badge>
            {status !== "isenta" && dias !== null && (
              <span className="text-sm text-muted-foreground">
                {dias >= 0
                  ? `${dias} ${dias === 1 ? "dia restante" : "dias restantes"}`
                  : `vencido há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"}`}
              </span>
            )}
          </div>
          {status === "isenta" && (
            <p className="text-sm text-muted-foreground">
              Esta igreja está isenta. Use o sistema inteiro, sem custo e sem
              limite de funcionalidade.
            </p>
          )}
          {status === "trial" && (
            <p className="text-sm text-muted-foreground">
              Vocês estão nos {DIAS_TRIAL} dias de teste. Nada é cobrado agora e
              nenhum cartão foi pedido.
            </p>
          )}
        </CardContent>
      </Card>

      {status !== "isenta" && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Como pagar</CardTitle>
            <CardDescription>
              R$ {PRECO_MENSAL}/mês ou R$ {PRECO_ANUAL}/ano — cobre servidor e
              domínio, nada além.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pixKey ? (
              <>
                <div className="rounded-2xl bg-muted px-4 py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Chave Pix
                  </p>
                  <p className="mt-1 font-mono text-base break-all">{pixKey}</p>
                  {pixNome && (
                    <p className="mt-1 text-sm text-muted-foreground">{pixNome}</p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Depois de pagar, avise aqui — a validade é atualizada assim que
                  conferirmos.
                </p>
                <ClaimPaymentButton
                  churchSlug={churchSlug}
                  churchId={tenant.church.id}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                A chave Pix ainda não foi configurada nesta instalação.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartHandshake className="size-4" />
            Sem condição de pagar?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            É só pedir a isenção — sem constrangimento e sem perder nenhuma
            funcionalidade. O Acts existe para servir a igreja, não para cobrar
            dela. Quem pode contribuir sustenta quem não pode.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
