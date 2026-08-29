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

function isVisible(notice: KidsPersonalNotice, now: number) {
  if (notice.kind !== "fim_sessao") return true;
  return new Date(notice.created_at).getTime() + SESSION_END_TTL_MS > now;
}

export function KidsNoticeBanner({
  churchSlug,
  notices: serverNotices,
}: {
  churchSlug: string;
  notices: KidsPersonalNotice[];
}) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const notices = serverNotices.filter(
    (notice) => !dismissedIds.has(notice.page_id) && isVisible(notice, now)
  );

  useEffect(() => {
    const nextExpiry = serverNotices
      .filter((notice) => notice.kind === "fim_sessao")
      .map((notice) => new Date(notice.created_at).getTime() + SESSION_END_TTL_MS)
      .filter((expiresAt) => expiresAt > now)
      .sort((a, b) => a - b)[0];

    if (!nextExpiry) return;

    const timer = window.setTimeout(() => {
      setNow(Date.now());
    }, Math.max(0, nextExpiry - now) + 50);

    return () => window.clearTimeout(timer);
  }, [serverNotices, now]);

  if (notices.length === 0) return null;

  function acknowledge(pageId: string) {
    setPendingId(pageId);
    startTransition(async () => {
      const result = await acknowledgeKidsNotice({ churchSlug, pageId });
      if (result.ok) {
        setDismissedIds((current) => {
          const next = new Set(current);
          next.add(pageId);
          return next;
        });
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
              "Encerramento do culto Kids. Aguardamos você na recepção para retirada."
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
