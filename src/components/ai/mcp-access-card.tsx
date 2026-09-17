"use client";

import { Select } from "@/components/ui/select";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, PlugZap, X } from "lucide-react";
import { toast } from "sonner";
import {
  createMcpAccessToken,
  revokeMcpAccessToken,
} from "@/lib/actions/mcp-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type McpAccessListItem = {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

function dateLabel(value: string | null) {
  if (!value) return "Sem expiração";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function dateTimeLabel(value: string | null) {
  if (!value) return "Nunca usado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function McpAccessCard({
  churchSlug,
  ministryId,
  ministryName,
  initialTokens,
}: {
  churchSlug: string;
  ministryId: string;
  ministryName: string;
  initialTokens: McpAccessListItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("Integração MCP");
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyToken() {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
    toast.success("Token copiado");
    window.setTimeout(() => setCopied(false), 1500);
  }

  function createToken() {
    startTransition(async () => {
      const result = await createMcpAccessToken({
        churchSlug,
        ministryId,
        name,
        expiresInDays,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCreatedToken(result.data.token);
      toast.success("Acesso MCP criado");
      router.refresh();
    });
  }

  function revokeToken(tokenId: string) {
    startTransition(async () => {
      const result = await revokeMcpAccessToken({ churchSlug, tokenId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Acesso MCP revogado");
      router.refresh();
    });
  }

  const activeTokens = initialTokens.filter((token) => !token.revoked_at);
  const revokedTokens = initialTokens.filter((token) => token.revoked_at);

  return (
    <Card className="border-foreground/10">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <PlugZap className="size-5" />
          <CardTitle className="text-base">Acesso externo via MCP</CardTitle>
        </div>
        <CardDescription>
          Conecte ferramentas externas ao LUNOR com acesso somente leitura ao ministério {ministryName}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border bg-muted/20 p-4 text-sm">
          <p className="font-medium">Endpoint</p>
          <code className="mt-1 block break-all text-xs text-muted-foreground">https://lunorservice.com/api/mcp</code>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            O token define a igreja e o ministério. Clientes externos não podem trocar esse escopo por parâmetros ou headers.
          </p>
        </div>

        {createdToken && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Guarde este token agora</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Por segurança, o LUNOR armazena apenas o hash e não conseguirá mostrar este token novamente.
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Input value={createdToken} readOnly className="min-w-0 font-mono text-xs" />
              <Button type="button" variant="outline" size="icon-lg" onClick={copyToken} aria-label="Copiar token">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3 border-t pt-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_150px_auto] sm:items-end">
            <label className="space-y-1.5 text-sm font-medium">
              Nome da integração
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="Ex.: ChatGPT da liderança"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Validade
              <Select
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(Number(event.target.value))}
                className="w-full"
              >
                <option value={30}>30 dias</option>
                <option value={90}>90 dias</option>
                <option value={180}>180 dias</option>
                <option value={365}>1 ano</option>
              </Select>
            </label>
            <Button
              type="button"
              onClick={createToken}
              disabled={pending || name.trim().length < 2}
              className="px-5"
            >
              {pending ? "Aguarde…" : "Criar acesso"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Escopo atual: <strong>somente leitura operacional</strong>. O token não cria escalas, não altera pessoas e não envia mensagens.
          </p>
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Credenciais ativas</p>
              <p className="text-xs text-muted-foreground">{activeTokens.length} acesso(s)</p>
            </div>
          </div>
          {activeTokens.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              Nenhum acesso externo criado para este ministério.
            </p>
          ) : (
            <div className="divide-y rounded-2xl border">
              {activeTokens.map((token) => (
                <div key={token.id} className="flex items-center gap-3 px-4 py-3">
                  <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{token.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-mono">{token.token_prefix}…</span> · expira {dateLabel(token.expires_at)} · {dateTimeLabel(token.last_used_at)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    onClick={() => revokeToken(token.id)}
                    aria-label={`Revogar ${token.name}`}
                    title="Revogar acesso"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {revokedTokens.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {revokedTokens.length} credencial(is) revogada(s) permanecem no histórico de auditoria.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
