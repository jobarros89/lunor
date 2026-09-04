"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Copy, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FamilyInviteQr } from "@/components/infantil/family-invite-qr";
import { createGuardianInvite } from "@/lib/actions/guardian-family";

type Guardian = {
  id: string;
  fullName: string;
  userId: string | null;
};

export function GuardianInvitePanel({
  churchSlug,
  guardians,
}: {
  churchSlug: string;
  guardians: Guardian[];
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [inviteUrls, setInviteUrls] = useState<Record<string, string>>({});

  function createInvite(guardian: Guardian) {
    setPendingId(guardian.id);
    startTransition(async () => {
      const result = await createGuardianInvite({
        churchSlug,
        guardianId: guardian.id,
      });
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setInviteUrls((current) => ({ ...current, [guardian.id]: result.data.url }));
      toast.success("Convite familiar criado");
    });
  }

  async function copyInvite(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  async function shareInvite(guardian: Guardian, url: string) {
    if (!("share" in navigator)) {
      await copyInvite(url);
      return;
    }
    try {
      await navigator.share({
        title: "Acesso de responsável — LUNOR Kids",
        text: `${guardian.fullName}, use este convite para acessar o LUNOR Kids como responsável.`,
        url,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Não foi possível compartilhar o convite");
    }
  }

  if (guardians.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
        Nenhum responsável foi cadastrado ainda. Cadastre a criança e seus responsáveis para gerar o acesso familiar.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {guardians.map((guardian) => {
        const inviteUrl = inviteUrls[guardian.id];
        const linked = Boolean(guardian.userId);
        return (
          <article key={guardian.id} className="rounded-3xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-medium">{guardian.fullName}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {linked && <CheckCircle2 className="size-3.5" />}
                  {linked ? "Conta LUNOR já vinculada" : "Ainda sem conta LUNOR vinculada"}
                </p>
              </div>
              {!linked && (
                <Button
                  type="button"
                  variant={inviteUrl ? "outline" : "default"}
                  disabled={pending && pendingId === guardian.id}
                  onClick={() => createInvite(guardian)}
                  className="h-10 rounded-full px-4"
                >
                  <Send className="size-4" />
                  {pending && pendingId === guardian.id
                    ? "Gerando…"
                    : inviteUrl
                      ? "Gerar novo convite"
                      : "Gerar convite"}
                </Button>
              )}
            </div>

            {inviteUrl && !linked && (
              <div className="mt-5 grid gap-5 border-t pt-5 md:grid-cols-[14rem_1fr] md:items-center">
                <div className="mx-auto md:mx-0">
                  <FamilyInviteQr
                    value={inviteUrl}
                    label={`QR Code de acesso de responsável para ${guardian.fullName}`}
                  />
                </div>
                <div className="min-w-0 space-y-4">
                  <div>
                    <p className="font-medium">Acesso de responsável</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      O responsável pode apontar a câmera do celular para o QR Code. O link abre diretamente o cadastro ou login do LUNOR Kids e mantém o vínculo com a família.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-muted/50 p-3">
                    <p className="break-all text-xs text-muted-foreground">{inviteUrl}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => copyInvite(inviteUrl)}
                      className="rounded-full"
                    >
                      <Copy className="size-4" />
                      Copiar link
                    </Button>
                    <Button
                      type="button"
                      onClick={() => shareInvite(guardian, inviteUrl)}
                      className="rounded-full"
                    >
                      <Share2 className="size-4" />
                      Compartilhar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ao gerar um novo convite, o link anterior deixa de ser válido.
                  </p>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
