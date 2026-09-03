"use client";

import { FormEvent, useState } from "react";
import { ArrowUp, Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type AssistantResponse = {
  answer?: string;
  error?: string;
};

const SUGGESTIONS = [
  "O que precisa da minha atenção nos próximos cultos?",
  "Quem confirmou o próximo culto?",
  "Quem está indisponível para o próximo culto?",
];

export function AssistantPanel({
  churchSlug,
  ministryId,
  ministryName,
}: {
  churchSlug: string;
  ministryId: string;
  ministryName: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);

  async function ask(text: string) {
    const clean = text.trim();
    if (!clean || pending) return;

    const history = messages.slice(-8);
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
      setMessages((current) => [...current, { role: "assistant", content }]);
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <div className="space-y-5">
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
                "max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%]",
                message.role === "user"
                  ? "bg-foreground text-background"
                  : "border border-foreground/10 bg-muted/35"
              )}
            >
              {message.content}
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

      <form onSubmit={submit} className="sticky bottom-20 rounded-3xl border bg-background/95 p-2 shadow-lg backdrop-blur md:bottom-4">
        <div className="flex items-end gap-2">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ex.: Quem ainda não confirmou domingo?"
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
        Nesta fase, o assistente apenas consulta dados. Nenhuma alteração é feita sem uma ação explícita no LUNOR.
      </p>
    </div>
  );
}
