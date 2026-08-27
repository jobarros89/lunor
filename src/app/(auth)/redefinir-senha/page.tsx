"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Estado = "verificando" | "pronto" | "invalido";

function RedefinirSenhaContent() {
  const searchParams = useSearchParams();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirma, setMostrarConfirma] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const code = searchParams.get("code");
    let ativo = true;

    async function prepararSessao() {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (ativo) setEstado("invalido");
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (ativo) setEstado(data.session ? "pronto" : "invalido");
    }

    void prepararSessao();

    return () => {
      ativo = false;
    };
  }, [searchParams]);

  function submit() {
    if (senha.length < 8) {
      return toast.error("A senha precisa de pelo menos 8 caracteres");
    }
    if (senha !== confirma) {
      return toast.error("As senhas não coincidem");
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        console.error("updatePassword:", error);
        toast.error("Não foi possível atualizar. Peça um novo link.");
        return;
      }

      await supabase.auth.signOut();
      toast.success("Senha atualizada. Entre novamente.");
      window.location.assign("/login?senha=atualizada");
    });
  }

  if (estado === "verificando") {
    return (
      <Card className="rounded-3xl shadow-sm">
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">Verificando o link…</p>
        </CardContent>
      </Card>
    );
  }

  if (estado === "invalido") {
    return (
      <Card className="rounded-3xl shadow-sm">
        <CardContent className="space-y-4 py-8 text-center">
          <h1 className="text-lg font-semibold tracking-tight">
            Link inválido ou expirado
          </h1>
          <p className="text-sm text-muted-foreground">
            Peça um novo link para criar sua senha.
          </p>
          <Link href="/esqueci-senha" className="block">
            <Button className="h-12 w-full rounded-full text-base">
              Pedir novo link
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const senhaValida = senha.length >= 8;
  const senhasIguais = confirma.length > 0 && senha === confirma;

  return (
    <Card className="rounded-3xl shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Criar nova senha
        </CardTitle>
        <CardDescription>Use pelo menos 8 caracteres</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="senha">Nova senha</Label>
          <div className="relative">
            <Input
              id="senha"
              type={mostrarSenha ? "text" : "password"}
              autoComplete="new-password"
              minLength={8}
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="h-12 rounded-full pr-12"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((valor) => !valor)}
              className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            >
              {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {senhaValida ? "✓ Pelo menos 8 caracteres" : "Pelo menos 8 caracteres"}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirma">Repita a senha</Label>
          <div className="relative">
            <Input
              id="confirma"
              type={mostrarConfirma ? "text" : "password"}
              autoComplete="new-password"
              minLength={8}
              required
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              className="h-12 rounded-full pr-12"
            />
            <button
              type="button"
              onClick={() => setMostrarConfirma((valor) => !valor)}
              className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              aria-label={mostrarConfirma ? "Ocultar confirmação" : "Mostrar confirmação"}
            >
              {mostrarConfirma ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {confirma.length > 0 && (
            <p className={`text-xs ${senhasIguais ? "text-foreground" : "text-destructive"}`}>
              {senhasIguais ? "✓ As senhas coincidem" : "As senhas não coincidem"}
            </p>
          )}
        </div>

        <Button
          type="button"
          disabled={pending || !senhaValida || !senhasIguais}
          onClick={submit}
          className="h-12 w-full rounded-full text-base"
        >
          {pending ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <RedefinirSenhaContent />
    </Suspense>
  );
}
