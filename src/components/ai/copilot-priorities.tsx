"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LeadershipInsight } from "@/lib/ai/leadership-insights";
import { copilotSuggestion, copilotSuggestionHref } from "@/lib/ai/copilot-suggestions";

type Attention = { insights: LeadershipInsight[]; generatedAt: string };

export function CopilotPriorities({ churchSlug, ministryId, pending, onPrepare }: {
  churchSlug: string; ministryId: string; pending: boolean;
  onPrepare: (question: string) => void;
}) {
  const [result, setResult] = useState<Attention | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    // Read-only, deterministic priorities: opening the panel does not call the
    // language model, send messages or run a proposal confirmation action.
    fetch(`/api/ai/attention?${new URLSearchParams({ churchSlug, ministryId })}`, {
      signal: controller.signal, cache: "no-store",
    }).then(async response => {
      if (!response.ok) throw new Error("attention_unavailable");
      const data = await response.json() as Attention;
      if (!controller.signal.aborted) setResult(data);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [churchSlug, ministryId, retry]);

  const visible = (result?.insights ?? [])
    .filter(item => !dismissed.has(item.id)).slice(0, 3);

  return (
    <section aria-label="Prioridades do copiloto" className="space-y-3 rounded-2xl border border-brand/20 bg-brand/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">O que podemos adiantar?</h2>
        <button type="button" disabled={!result && !failed}
          onClick={() => { setResult(null); setFailed(false); setDismissed(new Set()); setRetry(n => n + 1); }}
          className="min-h-10 text-xs font-medium underline disabled:opacity-50">Atualizar</button>
      </div>
      {!result && !failed && <p role="status" className="text-xs text-muted-foreground">Conferindo os próximos cultos…</p>}
      {failed && <p role="status" className="text-xs text-muted-foreground">Não foi possível conferir as prioridades. Você pode tentar novamente ou usar o chat.</p>}
      {result && <p className="text-xs text-muted-foreground">Consultado às {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(result.generatedAt))} · Sugestões para revisão, sem alterações automáticas.</p>}
      {visible.map(insight => {
        const action = copilotSuggestion(insight);
        return (
          <article key={insight.id} className="space-y-2 rounded-xl border bg-background p-3">
            <p className="text-[11px] font-medium text-muted-foreground">{insight.ministry.name} · {insight.severity === "critical" ? "Prioridade alta" : insight.severity === "warning" ? "Atenção" : "Acompanhamento"}</p>
            <h3 className="text-sm font-semibold">{insight.title}</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">{insight.detail}</p>
            <p className="text-xs leading-relaxed">{insight.suggestedAction}</p>
            <div className="flex flex-wrap items-center gap-2">
              {insight.ministry.id === ministryId ? (
                <button type="button" disabled={pending} onClick={() => onPrepare(action.question)}
                  className="min-h-10 rounded-full bg-brand px-4 text-xs font-medium text-brand-foreground disabled:opacity-50">{action.label}</button>
              ) : (
                <Link href={copilotSuggestionHref(churchSlug, insight)} className="inline-flex min-h-10 items-center rounded-full bg-brand px-4 text-xs font-medium text-brand-foreground">Revisar em {insight.ministry.name}</Link>
              )}
              <button type="button" onClick={() => setDismissed(current => new Set(current).add(insight.id))}
                className="min-h-10 px-3 text-xs text-muted-foreground">Agora não</button>
            </div>
          </article>
        );
      })}
      {result && visible.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma sugestão adicional nesta consulta. Atualize para conferir novamente.</p>}
    </section>
  );
}
