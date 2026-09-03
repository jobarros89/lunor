"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createChurch, joinChurch } from "@/lib/actions/church";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ComecarContent() {
  const searchParams = useSearchParams();
  const intent = searchParams.get("intencao");
  const initialMode = intent === "criar" ? "create" : intent === "entrar" ? "join" : "choose";
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"choose" | "join" | "create">(initialMode);

  function submit(action: typeof createChurch, formData: FormData) {
    startTransition(async () => {
      const result = await action(formData);
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
    <div className="w-full max-w-lg space-y-4">
      <Card className="rounded-3xl shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {mode === "choose" ? "Como você quer usar o LUNOR?" : mode === "join" ? "Entrar em uma igreja" : "Criar sua igreja"}
          </CardTitle>
          <CardDescription>
            {mode === "choose" ? "Escolha como deseja começar." : mode === "join" ? "Use o convite que você recebeu. Se tiver um código, informe abaixo." : "Informe o nome da sua igreja para começar a configuração."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "choose" && <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setMode("create")} className="min-h-32 rounded-2xl border p-5 text-left transition-colors hover:border-foreground/40 hover:bg-muted/40">
              <strong className="block text-base">Criar uma igreja</strong>
              <span className="mt-2 block text-sm text-muted-foreground">Sou responsável pela gestão e quero configurar o LUNOR.</span>
            </button>
            <button type="button" onClick={() => setMode("join")} className="min-h-32 rounded-2xl border p-5 text-left transition-colors hover:border-foreground/40 hover:bg-muted/40">
              <strong className="block text-base">Entrar em uma igreja</strong>
              <span className="mt-2 block text-sm text-muted-foreground">Recebi um convite para acessar o LUNOR da minha igreja.</span>
            </button>
          </div>}

          {mode === "join" && <form action={(fd) => submit(joinChurch, fd)} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="inviteCode">Código do convite</Label><Input id="inviteCode" name="inviteCode" required autoCapitalize="none" autoComplete="off" spellCheck={false} className="h-12 rounded-full text-center font-mono tracking-widest" /></div>
            <Button type="submit" disabled={pending} className="h-12 w-full rounded-full text-base">{pending ? "Verificando…" : "Continuar"}</Button>
          </form>}

          {mode === "create" && <form action={(fd) => submit(createChurch, fd)} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="name">Nome da igreja</Label><Input id="name" name="name" required autoComplete="organization" className="h-12 rounded-full" /></div>
            <p className="text-xs text-muted-foreground">Exemplo: Igreja Batista Central. O endereço no LUNOR será criado automaticamente.</p>
            <Button type="submit" disabled={pending} className="h-12 w-full rounded-full text-base">{pending ? "Criando…" : "Criar e configurar"}</Button>
          </form>}
        </CardContent>
      </Card>
      {mode !== "choose" && <button type="button" onClick={() => setMode("choose")} className="min-h-11 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline">Escolher outra opção</button>}
    </div>
  </main>;
}

export default function ComecarPage() {
  return (
    <Suspense fallback={null}>
      <ComecarContent />
    </Suspense>
  );
}
