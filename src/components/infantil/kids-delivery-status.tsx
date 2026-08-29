import { CheckCircle2, Clock3 } from "lucide-react";

export type KidsDeliveryStatus = {
  recipientCount: number;
  acknowledgedCount: number;
  lastAcknowledgedAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

function formatTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function KidsDeliveryStatusView({ status }: { status: KidsDeliveryStatus }) {
  if (status.recipientCount === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock3 className="size-3.5" />
        Aviso registrado · nenhum responsável com conta LUNOR vinculada
      </p>
    );
  }

  if (status.acknowledgedCount === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
        <Clock3 className="size-3.5" />
        Enviado a {status.recipientCount} {status.recipientCount === 1 ? "responsável" : "responsáveis"} · aguardando leitura
      </p>
    );
  }

  const time = formatTime(status.lastAcknowledgedAt);
  const allRead = status.acknowledgedCount >= status.recipientCount;

  return (
    <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
      <CheckCircle2 className="size-3.5" />
      {allRead
        ? `Todos confirmaram (${status.acknowledgedCount}/${status.recipientCount})`
        : `${status.acknowledgedCount}/${status.recipientCount} confirmaram`}
      {time ? ` · ${time}` : ""}
    </p>
  );
}
