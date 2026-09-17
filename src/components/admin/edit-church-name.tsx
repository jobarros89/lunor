"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateChurchName } from "@/lib/actions/church";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EditChurchName({
  churchSlug,
  churchId,
  currentName,
}: {
  churchSlug: string;
  churchId: string;
  currentName: string;
}) {
  const [name, setName] = useState(currentName);
  const [pending, startTransition] = useTransition();
  const changed = name.trim() !== currentName.trim() && name.trim().length >= 2;

  function save() {
    startTransition(async () => {
      const result = await updateChurchName({ churchSlug, churchId, name });
      if (result && !result.ok) toast.error(result.error);
      else toast.success("Nome atualizado");
    });
  }

  return (
    <div className="flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1"
        maxLength={80}
      />
      <Button
        type="button"
        disabled={!changed || pending}
        onClick={save}
        className="px-5"
      >
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </div>
  );
}
