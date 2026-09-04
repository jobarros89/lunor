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
import { cn } from "@/lib/utils";

export default async function FamilyAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const invalidInvite = erro === "convite-invalido";
  const redeemError = erro === "convite";

  return (
    <main className="dark flex min-h-dvh items-center justify-center bg-[#0b0b0c] px-5 py-8 text-[#f4f3ef]">
      <div className="w-full max-w-sm">
        <Card className="border-white/10 bg-[#111113] text-[#f4f3ef] shadow-none sm:rounded-2xl">
          <CardHeader className="space-y-4 text-center">
            <BrandLockup className="items-center [&_span]:text-[#f4f3ef] [&_span:last-child]:text-zinc-400" />
            <p className="mx-auto w-fit rounded-full bg-[#6e5ce6]/15 px-3 py-1 text-xs font-medium text-[#b9afff]">
              LUNOR Kids · Responsável
            </p>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                Acesse como responsável
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Entre ou crie sua conta para acompanhar as crianças vinculadas ao seu convite.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {invalidInvite && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-200">
                Este convite de responsável é inválido. Peça um novo convite à equipe do Kids.
              </p>
            )}

            {redeemError && (
              <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                Não foi possível concluir o vínculo agora. Seu convite foi preservado para uma nova tentativa.
              </p>
            )}

            {!invalidInvite && (
              <>
                <Link
                  href="/login?familia=1"
                  className={cn(
                    buttonVariants(),
                    "h-12 w-full rounded-full bg-[#6e5ce6] text-base font-semibold text-white hover:bg-[#5f4fd1]"
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

            <p className="pt-1 text-center text-xs leading-relaxed text-zinc-500">
              Este acesso é exclusivo para responsáveis do LUNOR Kids. Você não precisa criar nem entrar em uma igreja manualmente.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
