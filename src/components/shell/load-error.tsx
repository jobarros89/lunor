import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Estado de FALHA de carregamento — distinto de "lista vazia".
 * Sem isso, um erro de rede/banco renderiza "nenhum item" e parece que
 * os dados foram apagados (o sistema promete o contrário).
 */
export function LoadError({ oQue = "os dados" }: { oQue?: string }) {
  return (
    <Card role="alert" className="rounded-3xl border-destructive/30">
      <CardContent className="flex items-start gap-3 py-5">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div>
          <p className="font-medium">Não foi possível carregar {oQue}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Pode ter sido a conexão. Atualize a página para tentar de novo.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
