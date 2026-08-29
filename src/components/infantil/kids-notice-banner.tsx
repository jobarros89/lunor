"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acknowledgeKidsNotice } from "@/lib/actions/kids-notice";

const SESSION_END_TTL_MS = 20 * 60 * 1000;

export type KidsPersonalNotice = {
  page_id: string;
  code: string | null;
  kind: "chamar" | "fim_sessao";
  created_at: string;
};

function isVisible(notice: KidsPersonalNotice, now = Date.now()) {
  if (notice.kind !== "fim_sessao") return true;
  return new Date(notice.created_at).getTime() + SESSION_END_TTL_MS > now;
}

function pruneExpired(notices: KidsPersonalNotice[], now: number) {
  const filtered = notices.filter((notice) => isVisible(notice, now));
  return filtered.length === notices.length ? notices : filtered;
}

export function KidsNoticeBanner({
  churchSlug,
  notices: initialNotices,
}: {
  churchSlug: string;
  notices: KidsPersonalNotice[];
}) {
  const [notices, setNotices] = useState(initialNotices);
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    const now = Date.now();
    setNotices((current) => pruneExpired(current, now));

    const nextExpiry = notices
      .filter((notice) => notice.kind === "fim_sessao")
      .map((notice) => new Date(notice.created_at).getTime() + SESSION_END_TTL_MS)
      .filter((expiresAt) => expiresAt > now)
      .sort((a, b) => a - b)[0];

    if (!nextExpiry) return;

    const timer = window.setTimeout(() => {
      setNotices((current) => pruneExpired(current, Date.now()));
    }, Math.max(0, nextExpiry - now) + 50);

    return () => window.clearTimeout(timer);
  }, [notices]);

  if (notices.length === 0) return null;

  function acknowledge(pageId: string) {
    setPendingId(pageId);
    startTransition(async () => {
      const result = await acknowledgeKidsNotice({ churchSlug, pageId });
      if (result.ok) {
        setNotices((current) => current.filter((notice) => notice.page_id !== pageId));
        toast.success("Aviso confirmado para a equipe Kids");
      } else {
        toast.error(result.error);
      }
      setPendingId(null);
    });
  }

  return (
    <section className="mb-4 space-y-2" aria-live="polite">
      {notices.map((notice) => (
        <div
          key={notice.page_id}
          className="flex items-center gap-3 border-l-4 border-[#6e5ce6] bg-black px-5 py-4 text-white"
        >
          <Megaphone className="size-4 shrink-0" />
          <p className="min-w-0 flex-1 text-sm font-medium">
            {notice.kind === "fim_sessao" ? (
              "O Kids terminou — você já pode buscar a criança."
            ) : (
              <>
                Kids chama o código <span className="font-mono font-bold">{notice.code}</span> — compareça à recepção.
              </>
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={pending && pendingId === notice.page_id}
            onClick={() => acknowledge(notice.page_id)}
            className="h-9 shrink-0 rounded-full border-white/35 bg-white/10 px-4 text-white hover:bg-white hover:text-black"
          >
            <Check className="size-4" />
            {pending && pendingId === notice.page_id ? "…" : "OK"}
          </Button>
        </div>
      ))}
    </section>
  );
}
