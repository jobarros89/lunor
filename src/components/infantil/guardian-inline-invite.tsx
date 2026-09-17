"use client";

import { useState, useTransition } from "react";
import { Copy, QrCode, Send, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FamilyInviteQr } from "@/components/infantil/family-invite-qr";
import { createGuardianInvite } from "@/lib/actions/guardian-family";

type Props = {
  churchSlug: string;
  guardianId: string;
  guardianName: string;
  email: string | null;
};

export function GuardianInlineInvite({
  churchSlug,
  guardianId,
  guardianName,
  email,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  function createInvite() {
    const normalizedEmail = (email ?? "").trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Este responsável não possui e-mail cadastrado.");
      return;
    }

    startTransition(async () => {
      const result = await createGuardianInvite({
        churchSlug,
        guardianId,
        email: normalizedEmail,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setInviteUrl(result.data.url);
      toast.success("Convite familiar criado");
    });
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  async function shareInvite() {
    if (!inviteUrl) return;
    if (!("share" in navigator)) {
      await copyInvite();
      return;
    }

    try {
      await navigator.share({
        title: "Acesso de responsável — LUNOR Kids",
        text: `${guardianName}, use este convite para acessar o LUNOR Kids como responsável.`,
        url: inviteUrl,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Não foi possível compartilhar o convite");
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Acesso da família</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {email ?? "E-mail não cadastrado"}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={inviteUrl ? "outline" : "default"}
          disabled={pending || !email}
          onClick={createInvite}
        >
          <Send className="size-3.5" />
          {pending ? "Gerando…" : inviteUrl ? "Gerar novo convite" : "Gerar convite"}
        </Button>
      </div>

      {inviteUrl && (
        <div className="space-y-3 rounded-2xl bg-muted/50 p-3">
          <p className="break-all text-xs text-muted-foreground">{inviteUrl}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={copyInvite}>
              <Copy className="size-3.5" />
              Copiar link
            </Button>
            <Button type="button" size="sm" onClick={shareInvite}>
              <Share2 className="size-3.5" />
              Compartilhar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowQr((current) => !current)}
            >
              {showQr ? <X className="size-3.5" /> : <QrCode className="size-3.5" />}
              {showQr ? "Fechar QR" : "Ver QR Code"}
            </Button>
          </div>

          {showQr && (
            <div className="pt-1">
              <FamilyInviteQr
                value={inviteUrl}
                label={`QR Code de acesso de responsável para ${guardianName}`}
              />
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            O convite deve ser aberto pela pessoa que usará este mesmo e-mail no LUNOR. Ao gerar outro convite, o anterior deixa de ser válido.
          </p>
        </div>
      )}
    </div>
  );
}
