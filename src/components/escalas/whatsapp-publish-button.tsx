"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Summary = {
  sent: number;
  alreadySent: number;
  missingPhone: number;
  failed: number;
};

type ApiResponse =
  | { ok: true; data: Summary }
  | { ok: false; error: string };

export function WhatsAppPublishButton({
  churchSlug,
  churchId,
  ministryId,
  eventId,
}: {
  churchSlug: string;
  churchId: string;
  ministryId: string;
  eventId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function publish() {
    setPending(true);
    try {
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ churchSlug, churchId, ministryId, eventId }),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.ok) {
        toast.error(result.ok ? "Não foi possível publicar" : result.error);
        return;
      }

      const { sent, alreadySent, missingPhone, failed } = result.data;
      if (sent > 0) {
        toast.success(`${sent} confirmação${sent === 1 ? " enviada" : " enviadas"} pelo WhatsApp`);
      } else if (alreadySent > 0) {
        toast.success("Nenhuma confirmação nova para enviar");
      } else {
        toast.success("Escala processada");
      }
      if (missingPhone > 0) {
        toast.warning(`${missingPhone} pessoa${missingPhone === 1 ? " está" : "s estão"} sem telefone válido`);
      }
      if (failed > 0) {
        toast.warning(`${failed} envio${failed === 1 ? " falhou" : "s falharam"}`);
      }
      router.refresh();
    } catch {
      toast.error("Não foi possível falar com o serviço do WhatsApp");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" disabled={pending} onClick={publish} >
      <MessageCircle className="size-4" />
      {pending ? "Publicando…" : "Publicar no WhatsApp"}
    </Button>
  );
}
