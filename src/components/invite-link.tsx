"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

export function InviteLink({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");

  useEffect(() => {
    setInviteUrl(`${window.location.origin}/convite/${inviteCode}`);
  }, [inviteCode]);

  async function copyInvite() {
    if (!inviteUrl) return;

    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function shareInvite() {
    if (!inviteUrl) return;

    if (navigator.share) {
      await navigator.share({
        title: "Convite para o LUNOR",
        text: "Entre na equipe da nossa igreja no LUNOR.",
        url: inviteUrl,
      });
      return;
    }

    await copyInvite();
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 dark:border-white/15 dark:bg-black/20">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/50">
          Link de convite
        </p>
        <p className="mt-1 truncate text-sm text-zinc-950 dark:text-white" title={inviteUrl}>
          {inviteUrl || "Gerando link…"}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={copyInvite}
          disabled={!inviteUrl}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6e5ce6] dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copiado" : "Copiar link"}
        </button>

        <button
          type="button"
          onClick={shareInvite}
          disabled={!inviteUrl}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#6e5ce6] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6e5ce6]"
        >
          <Share2 className="size-4" />
          Compartilhar
        </button>
      </div>
    </div>
  );
}
