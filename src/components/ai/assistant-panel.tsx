"use client";

import { FormEvent, useState } from "react";
import {
  ArrowUp,
  Bot,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  Music2,
  Sparkles,
} from "lucide-react";
import { confirmAssistantAssignment } from "@/lib/actions/ai-assignment";
import { confirmAssistantWorshipSetlist } from "@/lib/actions/ai-worship-setlist";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  RecurringEventProposalCard,
  type RecurringEventProposal,
} from "@/components/ai/recurring-event-proposal-card";
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

type WorshipSetlistProposalSong = {
  position: number;
  songId: string;
  title: string;
  artist: string | null;
  defaultKey: string | null;
  bpm: number | null;
  timeSignature: string | null;
  usesLast120Days: number;
  lastUsedAt: string | null;
};

type WorshipSetlistProposal = {
  kind: "worship_setlist_proposal";
  event: { id: string; title: string; startsAt: string };
  songs: WorshipSetlistProposalSong[];
  warnings: string[];
};

type Message = {
  role: "user" | "assistant";
  content: string;
  proposals?: AssignmentProposal[];
  worshipSetlistProposals?: WorshipSetlistProposal[];
  recurringEventProposals?: RecurringEventProposal[];
};

type AssistantResponse = {
  answer?: string;
  proposals?: AssignmentProposal[];
  worshipSetlistProposals?: WorshipSetlistProposal[];
  recurringEventProposals?: RecurringEventProposal[];
  error?: string;
};

const GLOBAL_SUGGESTIONS = [
  "Como está a igreja como um todo?",
  "Quais ministérios precisam de atenção?",
  "O que preciso acompanhar nos próximos cultos?",
  "Prepare um panorama para a reunião de líderes.",
];

function proposalKey(proposal: AssignmentProposal) {
  return `${proposal.eventId}:${proposal.userId}:${proposal.roleName.toLocaleLowerCase("pt-BR")}`;
}

function worshipProposalKey(proposal: WorshipSetlistProposal) {
  return `${proposal.event.id}:${proposal.songs.map((song) => song.songId).join(",")}`;
}

function recurringProposalKey(proposal: RecurringEventProposal) {
  const first = proposal.occurrences.at(0)?.startsAt ?? "none";
  const last = proposal.occurrences.at(-1)?.startsAt ?? "none";
  return `${proposal.templateEventId}:${first}:${last}`;
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

function songMeta(song: WorshipSetlistProposalSong) {
  return [
    song.defaultKey ? `Tom ${song.defaultKey}` : "Tom não informado",
    song.bpm ? `${song.bpm} BPM` : "BPM não informado",
    song.timeSignature ?? "Compasso não informado",
  ].join(" · ");
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
  const [confirmingSetlist, setConfirmingSetlist] = useState<string | null>(null);
  const [confirmedSetlists, setConfirmedSetlists] = useState<Set<string>>(new Set());
  const [setlistErrors, setSetlistErrors] = useState<Record<string, string>>({});
  const [setlistSuccess, setSetlistSuccess] = useState<Record<string, string>>({});
  const suggestions = GLOBAL_SUGGESTIONS;

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
          worshipSetlistProposals: response.ok
            ? payload.worshipSetlistProposals ?? []
            : [],
          recurringEventProposals: response.ok
            ? payload.recurringEventProposals ?? []
            : [],
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "Não consegui acessar o assistente agora. Tente novamente em alguns instantes.",
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

  async function confirmWorshipSetlist(proposal: WorshipSetlistProposal) {
    const key = worshipProposalKey(proposal);
    if (confirmingSetlist || confirmedSetlists.has(key)) return;
    setConfirmingSetlist(key);
    setSetlistErrors((current) => ({ ...current, [key]: "" }));
    setSetlistSuccess((current) => ({ ...current, [key]: "" }));

    try {
      const result = await confirmAssistantWorshipSetlist({
        churchSlug,
        ministryId,
        eventId: proposal.event.id,
        songIds: proposal.songs.map((song) => song.songId),
      });
      if (!result.ok) {
        setSetlistErrors((current) => ({ ...current, [key]: result.error }));
        return;
      }

      const { added, skippedExisting } = result.data;
      const message =
        added === 0
          ? "Essas músicas já estavam no repertório."
          : skippedExisting > 0
            ? `${added} música${added === 1 ? "" : "s"} adicionada${added === 1 ? "" : "s"}; ${skippedExisting} já estava${skippedExisting === 1 ? "" : "m"} no repertório.`
            : `${added} música${added === 1 ? "" : "s"} adicionada${added === 1 ? "" : "s"} ao repertório.`;

      setConfirmedSetlists((current) => new Set(current).add(key));
      setSetlistSuccess((current) => ({ ...current, [key]: message }));
    } catch {
      setSetlistErrors((current) => ({
        ...current,
        [key]: "Não foi possível adicionar o repertório agora.",
      }));
    } finally {
      setConfirmingSetlist(null);
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
                Um único copiloto para os módulos que você gerencia. Contexto atual: {ministryName}.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
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
          <div>
            <p className="text-sm font-medium">Como posso ajudar no LUNOR?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Contexto atual: {ministryName}. Você pode perguntar sobre outros módulos que gerencia.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
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
            <div
              className={cn(
                "space-y-2",
                message.role === "user"
                  ? "max-w-[88%] sm:max-w-[75%]"
                  : "max-w-[92%] sm:max-w-[82%]"
              )}
            >
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
                    <div
                      key={key}
                      className="rounded-2xl border border-[#6e5ce6]/25 bg-background p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e5ce6]">
                            Sugestão de escala
                          </p>
                          <p className="mt-1 font-semibold">
                            {proposal.userName} · {proposal.roleName}
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="size-3.5" />
                            {proposal.eventTitle} · {eventDateLabel(proposal.startsAt)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
                            proposal.availability === "available"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          )}
                        >
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
                      {error && (
                        <p className="mt-2 text-xs font-medium text-destructive">{error}</p>
                      )}
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

              {message.role === "assistant" &&
                message.worshipSetlistProposals?.map((proposal) => {
                  const key = worshipProposalKey(proposal);
                  const isConfirmed = confirmedSetlists.has(key);
                  const isConfirming = confirmingSetlist === key;
                  const error = setlistErrors[key];
                  const success = setlistSuccess[key];
                  return (
                    <div
                      key={key}
                      className="rounded-2xl border border-[#6e5ce6]/25 bg-background p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#6e5ce6]/12 text-[#6e5ce6]">
                          <Music2 className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e5ce6]">
                            Proposta de repertório
                          </p>
                          <p className="mt-1 font-semibold">{proposal.event.title}</p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="size-3.5" />
                            {eventDateLabel(proposal.event.startsAt)} · {proposal.songs.length} músicas
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {proposal.songs.map((song) => (
                          <div
                            key={song.songId}
                            className="flex gap-3 rounded-xl border border-foreground/10 bg-muted/25 px-3 py-2.5"
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#6e5ce6]/10 text-xs font-semibold text-[#6e5ce6]">
                              {song.position}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{song.title}</p>
                              {song.artist && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {song.artist}
                                </p>
                              )}
                              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                                {songMeta(song)}
                              </p>
                              {song.usesLast120Days > 0 && (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Usada {song.usesLast120Days}x nos últimos 120 dias
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {proposal.warnings.length > 0 && (
                        <div className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                          {proposal.warnings.join(" ")}
                        </div>
                      )}

                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        Ao confirmar, o LUNOR adiciona estas músicas ao final do repertório atual e preserva tudo o que já estiver no culto.
                      </p>
                      {error && (
                        <p className="mt-2 text-xs font-medium text-destructive">{error}</p>
                      )}
                      {success && (
                        <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          {success}
                        </p>
                      )}
                      <Button
                        type="button"
                        onClick={() => void confirmWorshipSetlist(proposal)}
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
                            Adicionando…
                          </>
                        ) : isConfirmed ? (
                          <>
                            <CheckCircle2 className="size-4" />
                            Repertório atualizado
                          </>
                        ) : (
                          "Adicionar ao repertório"
                        )}
                      </Button>
                    </div>
                  );
                })}

              {message.role === "assistant" &&
                message.recurringEventProposals?.map((proposal) => (
                  <RecurringEventProposalCard
                    key={recurringProposalKey(proposal)}
                    churchSlug={churchSlug}
                    proposal={proposal}
                  />
                ))}
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
            placeholder="Ex.: Como está a igreja como um todo?"
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
        O contexto atual ajuda o LUNOR a priorizar, mas você pode perguntar sobre outros módulos que gerencia. Alterações só são gravadas depois de uma confirmação explícita.
      </p>
    </div>
  );
}
