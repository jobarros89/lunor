import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getGuardianInvitePreview } from "@/lib/guardian-invite-preview";
import { cn } from "@/lib/utils";

export default async function FamilyAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const preview = await getGuardianInvitePreview();
  const status = preview?.status ?? "invalid";
  const invalidInvite = erro === "convite-invalido" || status === "invalid";
  const expiredInvite = erro === "convite-expirado" || status === "expired" || (status === "valid" && !preview?.invitedEmail);
  const usedInvite = erro === "convite-usado" || status === "used";
  const emailMismatch = erro === "email";
  const linkedElsewhere = erro === "vinculado";
  const redeemError = erro === "convite";
  const validInvite = status === "valid" && Boolean(preview?.invitedEmail) && !invalidInvite && !expiredInvite;

  return (
    <main className="dark flex min-h-dvh items-center justify-center bg-[#0b0b0c] px-5 py-8 text-[#f4f3ef]">
      <div className="w-full max-w-sm">
        <Card className="border-white/10 bg-[#111113] text-[#f4f3ef] shadow-none sm:rounded-2xl">
          <CardHeader className="space-y-4 text-center">
            <BrandLockup className="items-center [&_span]:text-[#f4f3ef] [&_span:last-child]:text-zinc-400" />
            <p className="mx-auto w-fit rounded-full bg-brand/15 px-3 py-1 text-xs font-medium text-[#b9afff]">
              LUNOR Kids · Responsável
            </p>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                Acesse como responsável
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Este convite dá acesso somente às crianças vinculadas ao responsável.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {(validInvite || usedInvite || expiredInvite) && preview?.guardianName && (
              <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Convite para</p>
                <p className="font-medium text-white">{preview.guardianName}</p>
                {preview.invitedEmail && (
                  <p className="break-all text-sm text-zinc-300">{preview.invitedEmail}</p>
                )}
                {preview.churchName && (
                  <p className="text-xs text-zinc-500">{preview.churchName}</p>
                )}
              </div>
            )}

            {invalidInvite && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-200">
                Este convite é inválido. Peça um novo convite à equipe do Kids.
              </p>
            )}

            {expiredInvite && !invalidInvite && (
              <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                Este convite expirou ou foi criado antes da validação por e-mail. Peça à equipe do Kids para gerar um novo link.
              </p>
            )}

            {usedInvite && !expiredInvite && !invalidInvite && (
              <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                Este convite já foi utilizado. Se a conta é sua, entre com o e-mail indicado para continuar.
              </p>
            )}

            {emailMismatch && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-200">
                A conta utilizada possui outro e-mail. Entre com o mesmo e-mail para o qual este convite foi gerado.
              </p>
            )}

            {linkedElsewhere && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-200">
                Este responsável já está vinculado a outra conta LUNOR. A equipe do Kids precisa revisar o vínculo antes de continuar.
              </p>
            )}

            {redeemError && !emailMismatch && !linkedElsewhere && (
              <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                Não foi possível concluir o vínculo agora. O convite foi preservado para uma nova tentativa.
              </p>
            )}

            {validInvite && (
              <>
                <Link
                  href="/login?familia=1"
                  className={cn(
                    buttonVariants(),
                    "h-12 w-full rounded-full bg-brand text-base font-semibold text-brand-foreground hover:bg-brand-strong"
                  )}
                >
                  Entrar como responsável
                </Link>
                <Link
                  href="/signup?familia=acesso"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-12 w-full rounded-full border-white/15 bg-transparent text-base text-[#f4f3ef] hover:bg-white/5 hover:text-white"
                  )}
                >
                  Criar conta de responsável
                </Link>
              </>
            )}

            {usedInvite && !invalidInvite && !expiredInvite && (
              <Link
                href="/login?familia=1"
                className={cn(
                  buttonVariants(),
                  "h-12 w-full rounded-full bg-brand text-base font-semibold text-brand-foreground hover:bg-brand-strong"
                )}
              >
                Entrar para continuar
              </Link>
            )}

            <p className="pt-1 text-center text-xs leading-relaxed text-zinc-500">
              Você não precisa criar nem entrar em uma igreja manualmente. O vínculo é concluído automaticamente pelo convite.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
