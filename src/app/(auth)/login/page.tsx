"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import { toast } from "sonner";
import { signIn, signInWithGoogle } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { BrandLockup } from "@/components/brand-lockup";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.53c-.9.6-2.04.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.87A6.02 6.02 0 0 1 6.07 12c0-.65.11-1.28.32-1.87V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.61Z" />
      <path fill="#EA4335" d="M12 6c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.61C7.18 7.76 9.39 6 12 6Z" />
    </svg>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const shouldConfirmEmail = searchParams.get("cadastro") === "confirme-email";
  const googleErrorMessage =
    searchParams.get("erro") === "google"
      ? "Não foi possível concluir o login com Google"
      : null;
  const visibleError = error ?? googleErrorMessage;

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signIn(formData);
      if (result && !result.ok) {
        setError(result.error);
        toast.error(result.error);
      }
    });
  }

  function onGoogleSignIn() {
    setError(null);
    startTransition(async () => {
      const result = await signInWithGoogle();
      if (result && !result.ok) {
        setError(result.error);
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="border-white/10 bg-[#111113] text-[#f4f3ef] shadow-none sm:rounded-2xl">
      <CardHeader className="space-y-4 pb-7 text-center">
        <BrandLockup className="items-center [&_span]:text-[#f4f3ef] [&_span:last-child]:text-zinc-400" />
        <CardDescription>Entre para acessar seu ministério</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Button
          type="button"
          disabled={pending}
          onClick={onGoogleSignIn}
          className="h-14 w-full rounded-xl border border-white bg-white text-base font-semibold text-black shadow-none hover:-translate-y-px hover:bg-zinc-100 hover:text-black focus-visible:border-white focus-visible:ring-white/30 dark:border-white dark:bg-white dark:text-black dark:hover:bg-zinc-100 dark:hover:text-black"
        >
          <GoogleIcon />
          {pending ? "Conectando…" : "Continuar com Google"}
        </Button>

        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">ou</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form action={onSubmit} className="space-y-4">
          {shouldConfirmEmail && (
            <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
              Conta criada. Confirme seu e-mail e depois entre aqui. Se você chegou por um convite, ele será retomado automaticamente após o login.
            </p>
          )}
          <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" autoComplete="email" required className="h-12 rounded-lg border-white/15 bg-[#0b0b0c] focus-visible:border-[#6e5ce6] focus-visible:ring-[#6e5ce6]/25" /></div>
          <div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" autoComplete="current-password" required className="h-12 rounded-lg border-white/15 bg-[#0b0b0c] focus-visible:border-[#6e5ce6] focus-visible:ring-[#6e5ce6]/25" /></div>
          {visibleError && <p className="text-sm text-destructive">{visibleError}</p>}
          <Button type="submit" disabled={pending} className="h-12 w-full rounded-lg bg-[#6e5ce6] text-base font-semibold text-white hover:bg-[#5f4fd1]">{pending ? "Entrando…" : "Entrar"}</Button>
          <p className="text-center text-sm"><Link href="/esqueci-senha" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Esqueci minha senha</Link></p>
          <p className="text-center text-sm text-muted-foreground">Não tem conta?{" "}<Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">Criar conta</Link></p>
        </form>

        <p className="text-center text-xs leading-relaxed text-zinc-500">
          Ao continuar, você concorda com os{" "}
          <Link href="/termos" target="_blank" className="underline underline-offset-4 hover:text-zinc-300">Termos de Uso</Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className="underline underline-offset-4 hover:text-zinc-300">Política de Privacidade</Link>.
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
