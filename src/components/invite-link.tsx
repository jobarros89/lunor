"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

export function InviteLink({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);

  async function shareInvite() {
    const url = `${window.location.origin}/convite/${inviteCode}`;
    if (navigator.share) {
      await navigator.share({
        title: "Convite para o LUNOR",
        text: "Entre na equipe da nossa igreja no LUNOR.",
        url,
      });
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={shareInvite}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {copied ? <Check className="size-4" /> : navigator.share ? <Share2 className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Link copiado" : "Compartilhar convite"}
    </button>
  );
}
