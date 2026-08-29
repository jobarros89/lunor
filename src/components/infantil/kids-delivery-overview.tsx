import { Card, CardContent } from "@/components/ui/card";
import { KidsDeliveryStatusView, type KidsDeliveryStatus } from "@/components/infantil/kids-delivery-status";

export type KidsDeliveryItem = {
  pageId: string;
  kind: "chamar" | "fim_sessao";
  code: string | null;
  status: KidsDeliveryStatus;
};

export function KidsDeliveryOverview({ items }: { items: KidsDeliveryItem[] }) {
  if (items.length === 0) return null;

  return (
    <Card className="rounded-3xl">
      <CardContent className="space-y-3 px-4 py-4">
        <div>
          <p className="text-sm font-medium">Leitura dos avisos</p>
          <p className="text-xs text-muted-foreground">
            Confirmações recebidas dos responsáveis no LUNOR.
          </p>
        </div>
        <div className="divide-y">
          {items.map((item) => (
            <div key={item.pageId} className="space-y-1.5 py-3 first:pt-1 last:pb-1">
              <p className="text-xs font-medium">
                {item.kind === "fim_sessao" ? (
                  "Fim do Kids"
                ) : (
                  <>
                    Chamado · código <span className="font-mono font-bold">{item.code ?? "—"}</span>
                  </>
                )}
              </p>
              <KidsDeliveryStatusView status={item.status} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
