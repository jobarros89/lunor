"use client";

import { FormEvent, useState } from "react";
import { ArrowUp, Bot, CalendarDays, CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";
import { confirmAssistantAssignment } from "@/lib/actions/ai-assignment";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AssignmentProposal = {
  kind: "assignment";
  eventId: string;
  eventTitle: string;
  startsAt: string;
  userId: string;
  userName: string;
  roleName: string;
  departmentId: string | null;
  departmentName: string | null;
  availability: "available" | "unknown";
  availabilityLabel: string;
  rationale: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  proposals?: AssignmentProposal[];
};

type AssistantResponse = {
  answer?: string;
  proposals?: AssignmentProposal[];
  error?: string;
};

const SUGGESTIONS = [
  "O que precisa da minha atenção nos próximos cultos?",
  "Quem confirmou o próximo culto?",
  "Quem está indisponível para o próximo culto?",
  "Me ajude a montar a próxima escala.",
];

function proposalKey(proposal: AssignmentProposal) {
  return `${proposal.eventId}:${proposal.userId}:${proposal.roleName.toLocaleLowerCase("pt-BR")}`;
}

function eventDateLabel(startsAt: string) {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return "Culto";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AssistantPanel({
  churchSlug,
  ministryId,
  ministryName,
  compact = false,
}: {
  churchSlug: string;
  ministryId: string;
  ministryName: string;
  compact?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [proposalErrors, setProposalErrors] = useState<Record<string, string>>({});

  async function ask(text: string) {
    const clean = text.trim();
    if (!clean || pending) return;

    const history = messages.slice(-8).map(({ role, content }) => ({ role, content }));
    const userMessage: Message = { role: "user", content: clean };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setPending(true);

    try {
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ churchSlug, ministryId, question: clean, history }),
      });
      const payload = (await response.json()) as AssistantResponse;
      const content =
        response.ok && payload.answer
          ? payload.answer
          : "Não consegui consultar os dados agora. Tente novamente em alguns instantes.";
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content,
          proposals: response.ok ? payload.proposals ?? [] : [],
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "Não consegui acessar o assistente agora. Tente novamente em alguns instantes.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  async function confirmProposal(proposal: AssignmentProposal) {
    const key = proposalKey(proposal);
    if (confirming || confirmed.has(key)) return;
    setConfirming(key);
    setProposalErrors((current) => ({ ...current, [key]: "" }));

    try {
      const result = await confirmAssistantAssignment({
        churchSlug,
        ministryId,
        eventId: proposal.eventId,
        userId: proposal.userId,
        roleName: proposal.roleName,
      });
      if (!result.ok) {
        setProposalErrors((current) => ({ ...current, [key]: result.error }));
        return;
      }
      setConfirmed((current) => new Set(current).add(key));
    } catch {
      setProposalErrors((current) => ({
        ...current,
        [key]: "Não foi possível confirmar a escala agora.",
      }));
    } finally {
      setConfirming(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <div className={cn("space-y-5", compact && "space-y-4")}>
      {!compact && (
        <Card className="overflow-hidden rounded-3xl border-[#6e5ce6]/25 bg-gradient-to-br from-[#6e5ce6]/10 via-background to-background">
          <CardHeader className="space-y-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#6e5ce6] text-white">
              <Sparkles className="size-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Pergunte ao LUNOR</CardTitle>
              <CardDescription className="mt-1">
                Assistente operacional de {ministryName}. Ele consulta os dados reais do LUNOR antes de responder.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={pending}
                  onClick={() => void ask(suggestion)}
                  className="min-h-10 rounded-full border border-foreground/15 bg-background/70 px-4 text-left text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {compact && messages.length === 0 && (
        <div className="space-y-3 rounded-2xl border border-[#6e5ce6]/20 bg-[#6e5ce6]/5 p-4">
          <p className="text-sm font-medium">Como posso ajudar com {ministryName}?</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={pending}
                onClick={() => void ask(suggestion)}
                className="min-h-9 rounded-full border border-foreground/15 bg-background px-3 text-left text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3" aria-live="polite">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={cn(
              "flex gap-3",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.role === "assistant" && (
              <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#6e5ce6]/12 text-[#6e5ce6]">
                <Bot className="size-4" />
              </span>
            )}
            <div className={cn("space-y-2", message.role === "user" ? "max-w-[88%] sm:max-w-[75%]" : "max-w-[92%] sm:max-w-[82%]") }>
              <div
                className={cn(
                  "whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  message.role === "user"
                    ? "bg-foreground text-background"
                    : "border border-foreground/10 bg-muted/35"
                )}
              >
                {message.content}
              </div>

              {message.role === "assistant" &&
                message.proposals?.map((proposal) => {
                  const key = proposalKey(proposal);
                  const isConfirmed = confirmed.has(key);
                  const isConfirming = confirming === key;
                  const error = proposalErrors[key];
                  return (
                    <div key={key} className="rounded-2xl border border-[#6e5ce6]/25 bg-background p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e5ce6]">
                            Sugestão de escala
                          </p>
                          <p className="mt-1 font-semibold">{proposal.userName} · {proposal.roleName}</p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="size-3.5" />
                            {proposal.eventTitle} · {eventDateLabel(proposal.startsAt)}
                          </p>
                        </div>
                        <span className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
                          proposal.availability === "available"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        )}>
                          {proposal.availabilityLabel}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        {proposal.rationale}
                      </p>
                      {proposal.availability === "unknown" && (
                        <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                          A pessoa ainda não informou disponibilidade. Confirme somente se fizer sentido para sua equipe.
                        </p>
                      )}
                      {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}
                      <Button
                        type="button"
                        onClick={() => void confirmProposal(proposal)}
                        disabled={isConfirming || isConfirmed}
                        className={cn(
                          "mt-3 w-full rounded-full",
                          isConfirmed
                            ? "bg-emerald-600 text-white hover:bg-emerald-600"
                            : "bg-[#6e5ce6] text-white hover:bg-[#5f4fd1]"
                        )}
                      >
                        {isConfirming ? (
                          <>
                            <LoaderCircle className="size-4 animate-spin" />
                            Confirmando…
                          </>
                        ) : isConfirmed ? (
                          <>
                            <CheckCircle2 className="size-4" />
                            Escala confirmada
                          </>
                        ) : (
                          "Confirmar escala"
                        )}
                      </Button>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex size-8 items-center justify-center rounded-full bg-[#6e5ce6]/12 text-[#6e5ce6]">
              <Bot className="size-4" />
            </span>
            Consultando o LUNOR…
          </div>
        )}
      </div>

      <form
        onSubmit={submit}
        className={cn(
          "sticky rounded-3xl border bg-background/95 p-2 shadow-lg backdrop-blur",
          compact ? "bottom-0" : "bottom-20 md:bottom-4"
        )}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ex.: Quem posso escalar para baixo domingo?"
            rows={2}
            maxLength={1500}
            className="min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button
            type="submit"
            size="icon"
            disabled={pending || !question.trim()}
            className="size-11 shrink-0 rounded-full bg-[#6e5ce6] text-white hover:bg-[#5f4fd1]"
            aria-label="Enviar pergunta"
          >
            <ArrowUp className="size-5" />
          </Button>
        </div>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        O assistente consulta dados e pode preparar sugestões. Uma escala só é gravada depois de você confirmar explicitamente.
      </p>
    </div>
  );
}
