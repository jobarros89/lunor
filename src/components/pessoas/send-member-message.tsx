"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { sendMemberMessage } from "@/lib/actions/messages";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type MessageMinistryOption = {
  id: string | null;
  name: string;
};

export function SendMemberMessage({
  churchSlug,
  churchId,
  recipientUserId,
  recipientName,
  ministries,
}: {
  churchSlug: string;
  churchId: string;
  recipientUserId: string;
  recipientName: string;
  ministries: MessageMinistryOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [ministryId, setMinistryId] = useState<string>(
    ministries[0]?.id ?? "",
  );

  if (ministries.length === 0) return null;

  function submit() {
    const text = body.trim();
    if (!text) {
      toast.error("Escreva uma mensagem antes de enviar.");
      return;
    }

    startTransition(async () => {
      const result = await sendMemberMessage({
        churchSlug,
        churchId,
        ministryId: ministryId || null,
        recipientUserId,
        body: text,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setBody("");
      toast.success(`Mensagem enviada para ${recipientName}.`);
    });
  }

  return (
    <div className="space-y-3">
      {ministries.length > 1 && (
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Time</span>
          <select
            className="lunor-control w-full"
            value={ministryId}
            onChange={(event) => setMinistryId(event.target.value)}
            disabled={pending}
          >
            {ministries.map((ministry) => (
              <option key={ministry.id ?? "church"} value={ministry.id ?? ""}>
                {ministry.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={1000}
        placeholder={`Escreva uma mensagem para ${recipientName}…`}
        disabled={pending}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          A mensagem ficará disponível no LUNOR e também gera uma notificação.
        </p>
        <Button
          type="button"
          onClick={submit}
          disabled={pending || !body.trim()}
          className="shrink-0"
        >
          <Send className="size-4" />
          {pending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </div>
  );
}
