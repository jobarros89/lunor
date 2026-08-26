"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { signIn } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { BrandLockup } from "@/components/brand-lockup";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const shouldConfirmEmail = searchParams.get("cadastro") === "confirme-email";

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signIn(formData);
      if (result && !result.ok) { setError(result.error); toast.error(result.error); }
    });
  }

  return (
    <Card className="border-white/10 bg-[#111113] text-[#f4f3ef] shadow-none sm:rounded-2xl">
      <CardHeader className="space-y-4 pb-7 text-center">
        <BrandLockup className="items-center [&_span]:text-[#f4f3ef] [&_span:last-child]:text-zinc-400" />
        <CardDescription>Entre para acessar seu ministério</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-4">
          {shouldConfirmEmail && (
            <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
              Conta criada. Confirme seu e-mail e depois entre aqui. Se você chegou por um convite, ele será retomado automaticamente após o login.
            </p>
          )}
          <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" autoComplete="email" required className="h-12 rounded-lg border-white/15 bg-[#0b0b0c] focus-visible:border-[#6e5ce6] focus-visible:ring-[#6e5ce6]/25" /></div>
          <div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" autoComplete="current-password" required className="h-12 rounded-lg border-white/15 bg-[#0b0b0c] focus-visible:border-[#6e5ce6] focus-visible:ring-[#6e5ce6]/25" /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="h-12 w-full rounded-lg bg-[#6e5ce6] text-base font-semibold text-white hover:bg-[#5f4fd1]">{pending ? "Entrando…" : "Entrar"}</Button>
          <p className="text-center text-sm"><Link href="/esqueci-senha" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Esqueci minha senha</Link></p>
          <p className="text-center text-sm text-muted-foreground">Não tem conta?{" "}<Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">Criar conta</Link></p>
        </form>
      </CardContent>
    </Card>
  );
}
