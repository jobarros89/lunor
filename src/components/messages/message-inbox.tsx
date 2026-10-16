"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock3, MessageSquareText } from "lucide-react";
import { markInboxMessagesRead } from "@/lib/actions/messages";
import { Badge } from "@/components/ui/badge";

export type InboxMessageView = {
  id: string;
  kind: "direct" | "service_reminder";
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  senderName: string | null;
  recipientName: string | null;
  ministryName: string | null;
  eventUrl: string | null;
  direction: "received" | "sent";
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function MessageInbox({
  churchSlug,
  churchId,
  messages,
}: {
  churchSlug: string;
  churchId: string;
  messages: InboxMessageView[];
}) {
  const router = useRouter();
  const unreadKey = messages
    .filter((message) => message.direction === "received" && !message.readAt)
    .map((message) => message.id)
    .join(",");

  useEffect(() => {
    if (!unreadKey) return;
    let active = true;
    markInboxMessagesRead({
      churchSlug,
      churchId,
      messageIds: unreadKey.split(","),
    }).then((result) => {
      if (active && result.ok) router.refresh();
    });
    return () => {
      active = false;
    };
  }, [churchId, churchSlug, router, unreadKey]);

  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <MessageSquareText className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-3 font-medium">Nenhuma mensagem ainda</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Mensagens da liderança e lembretes de escala aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const content = (
          <article
            className={[
              "rounded-2xl border p-4 transition-colors",
              message.direction === "received" && !message.readAt
                ? "border-brand/30 bg-brand-soft/45"
                : "bg-card",
              message.eventUrl ? "hover:bg-muted/50" : "",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">
                    {message.kind === "service_reminder"
                      ? message.title
                      : message.direction === "received"
                        ? message.senderName || "Liderança"
                        : `Para ${message.recipientName || "membro"}`}
                  </h2>
                  {message.direction === "received" && !message.readAt && (
                    <Badge>Novo</Badge>
                  )}
                  {message.kind === "service_reminder" && (
                    <Badge variant="secondary">Escala</Badge>
                  )}
                </div>
                {(message.ministryName || message.direction === "sent") && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {message.ministryName || "Mensagem da igreja"}
                  </p>
                )}
              </div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" />
                {formatTimestamp(message.createdAt)}
              </span>
            </div>

            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
              {message.body}
            </p>

            {message.eventUrl && (
              <p className="mt-3 text-sm font-medium text-brand">
                Ver escala →
              </p>
            )}
          </article>
        );

        return message.eventUrl ? (
          <Link key={message.id} href={message.eventUrl} className="block">
            {content}
          </Link>
        ) : (
          <div key={message.id}>{content}</div>
        );
      })}
    </div>
  );
}
