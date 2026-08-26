"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteSong } from "@/lib/actions/louvor";
import { Button } from "@/components/ui/button";

export function SongDeleteButton({
  churchSlug,
  churchId,
  songId,
  songTitle,
}: {
  churchSlug: string;
  churchId: string;
  songId: string;
  songTitle: string;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function excluir() {
    if (
      !window.confirm(
        `Excluir “${songTitle}” permanentemente? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }

    setErro(null);
    startTransition(async () => {
      const result = await deleteSong({ churchSlug, churchId, songId });
      if (!result.ok) {
        setErro(result.error ?? "Não foi possível excluir a música");
        return;
      }

      router.push(`/${churchSlug}/louvor`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        className="rounded-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={pending}
        onClick={excluir}
      >
        <Trash2 className="size-4" />
        {pending ? "Excluindo…" : "Excluir música"}
      </Button>
      {erro && <p className="max-w-sm text-sm text-destructive">{erro}</p>}
    </div>
  );
}
