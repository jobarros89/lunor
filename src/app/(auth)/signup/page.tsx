"use client";

import Link from "next/link";
import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { signUp } from "@/lib/actions/auth";
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

function SignupForm() {
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const intent = searchParams.get("intencao");
  const passwordReady = password.length >= 8;

  const copy =
    intent === "criar"
      ? {
          title: "Crie sua conta",
          description:
            "Você será o administrador inicial da sua igreja no LUNOR.",
        }
      : intent === "convite" || intent === "entrar"
        ? {
            title: "Entre para sua equipe",
            description:
              intent === "convite"
                ? "Crie sua conta para aceitar o convite e entrar na igreja."
                : "Crie sua conta para entrar em uma igreja que já usa o LUNOR.",
          }
        : {
            title: "Crie sua conta",
            description: "Organize equipes, escalas e ministérios com o LUNOR.",
          };

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signUp(formData);
      if (result && !result.ok) {
        setError(result.error);
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="rounded-3xl shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          {copy.title}
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              required
              className="h-12 rounded-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-12 rounded-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 rounded-full pr-12"
                aria-describedby="password-requirement"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6e5ce6]"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p
              id="password-requirement"
              className={`flex items-center gap-2 text-xs ${passwordReady ? "text-foreground" : "text-muted-foreground"}`}
            >
              <span className={`flex size-4 items-center justify-center rounded-full border ${passwordReady ? "border-[#6e5ce6] bg-[#6e5ce6] text-white" : "border-foreground/25"}`}>
                {passwordReady && <Check className="size-3" strokeWidth={2.5} />}
              </span>
              Pelo menos 8 caracteres
            </p>
          </div>

          <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
            <input
              type="checkbox"
              name="legalAccepted"
              value="true"
              required
              className="mt-1 size-4 shrink-0 accent-[#6e5ce6]"
            />
            <span>
              Li e aceito os{" "}
              <Link
                href="/termos"
                target="_blank"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Termos de Uso
              </Link>{" "}
              e a{" "}
              <Link
                href="/privacidade"
                target="_blank"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Política de Privacidade
              </Link>
              .
            </span>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={pending}
            className="h-12 w-full rounded-full text-base"
          >
            {pending ? "Criando…" : "Criar conta"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Entrar
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
