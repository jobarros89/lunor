"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { archiveSong } from "@/lib/actions/louvor";
import { Button } from "@/components/ui/button";

export function SongArchiveButton({
  churchSlug,
  songId,
  active,
}: {
  churchSlug: string;
  songId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function alterarStatus() {
    if (
      active &&
      !window.confirm(
        "Arquivar esta música? Ela sairá do acervo padrão, mas continuará nos setlists antigos."
      )
    ) {
      return;
    }

    setErro(null);
    startTransition(async () => {
      const result = await archiveSong(churchSlug, songId, !active);
      if (!result.ok) {
        setErro(result.error ?? "Não foi possível alterar a música");
        return;
      }

      if (active) router.push(`/${churchSlug}/louvor`);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        className="rounded-full"
        disabled={pending}
        onClick={alterarStatus}
      >
        {active ? (
          <Archive className="size-4" />
        ) : (
          <ArchiveRestore className="size-4" />
        )}
        {pending
          ? "Salvando…"
          : active
            ? "Arquivar música"
            : "Reativar música"}
      </Button>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
