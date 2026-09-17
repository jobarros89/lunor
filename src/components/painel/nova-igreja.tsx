"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { createChurch } from "@/lib/actions/church";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NovaIgreja() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createChurch(formData);
      if (result && !result.ok) toast.error(result.error);
    });
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="px-5"
      >
        <Plus className="size-4" />
        Nova igreja
      </Button>
    );
  }

  return (
    <form
      action={onSubmit}
      className="flex w-full items-center gap-2 sm:w-auto"
    >
      <Input
        name="name"
        placeholder="Nome da nova igreja"
        required
        autoFocus
        className="flex-1 sm:w-64"
      />
      <Button
        type="submit"
        disabled={pending}
        className="px-5"
      >
        {pending ? "Criando…" : "Criar"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11"
        onClick={() => setOpen(false)}
        aria-label="Cancelar"
      >
        <X className="size-4" />
      </Button>
    </form>
  );
}
