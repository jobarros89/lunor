"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { signIn } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signIn(formData);
      if (result && !result.ok) { setError(result.error); toast.error(result.error); }
    });
  }

  return (
    <Card className="rounded-2xl shadow-none">
      <CardHeader className="space-y-3 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground">Presença · preparo · propósito</p>
        <CardTitle className="text-3xl font-medium tracking-[0.16em]">LUNOR</CardTitle>
        <CardDescription>Entre para acessar seu ministério</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" autoComplete="email" required className="h-12 rounded-xl" /></div>
          <div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" autoComplete="current-password" required className="h-12 rounded-xl" /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl bg-[#d8ff00] text-base text-black hover:bg-[#c7ee00]">{pending ? "Entrando…" : "Entrar"}</Button>
          <p className="text-center text-sm"><Link href="/esqueci-senha" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Esqueci minha senha</Link></p>
          <p className="text-center text-sm text-muted-foreground">Não tem conta?{" "}<Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">Criar conta</Link></p>
        </form>
      </CardContent>
    </Card>
  );
}
