"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ShareDailyVerseProps = {
  reference: string;
  text: string;
  churchName: string;
};

export function ShareDailyVerse({
  reference,
  text,
  churchName,
}: ShareDailyVerseProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    const shareText = `“${text}”\n\n${reference} · ${churchName}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Versículo do dia · ${reference}`,
          text: shareText,
          url,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(`${shareText}\n${url}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Button type="button" variant="outline" className="px-5" onClick={share}>
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {copied ? "Link copiado" : "Compartilhar"}
    </Button>
  );
}
