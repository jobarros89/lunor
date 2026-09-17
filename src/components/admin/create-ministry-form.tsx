"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { createMinistry } from "@/lib/actions/pessoas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TEAM_PRESETS = [
  "Louvor",
  "Kids",
  "Conexão",
  "Mídia",
  "Recepção",
  "Lojinha",
  "The Table",
  "Logística",
  "Intercessão",
  "MC",
] as const;

export function CreateMinistryForm({
  churchSlug,
  churchId,
}: {
  churchSlug: string;
  churchId: string;
}) {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function createTeam(name: string) {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createMinistry({ churchSlug, churchId, name });
      if (result && !result.ok) {
        toast.error(result.error);
      } else {
        toast.success(`Equipe ${name} criada`);
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function onSubmit(formData: FormData) {
    createTeam(String(formData.get("name") ?? ""));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TEAM_PRESETS.map((name) => (
          <Button
            key={name}
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => createTeam(name)}
            className="h-10 px-4"
          >
            + {name}
          </Button>
        ))}
      </div>

      <form action={onSubmit} className="flex gap-2">
        <Input
          ref={inputRef}
          name="name"
          placeholder="Outra equipe…"
          required
          className="h-12"
        />
        <Button type="submit" disabled={pending} className="h-12">
          {pending ? "Criando…" : "Criar equipe"}
        </Button>
      </form>
    </div>
  );
}
