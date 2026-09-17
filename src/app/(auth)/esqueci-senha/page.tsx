"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/lib/actions/auth";
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

export default function EsqueciSenhaPage() {
  const [pending, startTransition] = useTransition();
  const [enviado, setEnviado] = useState(false);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if (result && !result.ok) {
        toast.error(result.error);
        return;
      }
      setEnviado(true);
    });
  }

  if (enviado) {
    return (
      <Card className="shadow-sm">
        <CardContent className="space-y-4 py-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <MailCheck className="size-6" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">
            Verifique seu e-mail
          </h1>
          <p className="text-sm text-muted-foreground">
            Se houver uma conta com esse e-mail, enviamos um link para você
            criar uma nova senha. O link vale por pouco tempo.
          </p>
          <Link href="/login" className="block">
            <Button variant="outline" className="h-12 w-full">
              Voltar para o login
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Esqueceu a senha?
        </CardTitle>
        <CardDescription>
          Informe seu e-mail e enviamos um link para criar uma nova
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-12"
            />
          </div>
          <Button
            type="submit"
            disabled={pending}
            className="h-12 w-full text-base"
          >
            {pending ? "Enviando…" : "Enviar link"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Lembrou a senha?{" "}
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
