"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { seedClasses } from "@/lib/actions/infantil";

export function SeedClassesButton({
  churchSlug,
  ministryId,
}: {
  churchSlug: string;
  ministryId: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await seedClasses(churchSlug, ministryId);
          if (r.ok) toast.success("Turmas criadas");
          else toast.error(r.error);
        })
      }
    >
      {pending ? "Criando…" : "Criar turmas padrão"}
    </Button>
  );
}
