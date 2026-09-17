"use client";

import { Checkbox } from "@/components/ui/checkbox";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateKidsChild } from "@/lib/actions/kids-child-edit";

export type EditableKidsChild = {
  id: string;
  fullName: string;
  birthDate: string;
  allergies: string | null;
  healthNotes: string | null;
  specialNeeds: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  photoConsent: boolean;
};

export function ChildEditPanel({
  child,
  churchSlug,
  churchId,
  ministryId,
}: {
  child: EditableKidsChild;
  churchSlug: string;
  churchId: string;
  ministryId: string;
}) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [photoConsent, setPhotoConsent] = useState(child.photoConsent);

  function saveChild(fd: FormData) {
    startSaving(async () => {
      const result = await updateKidsChild({
        churchSlug,
        churchId,
        ministryId,
        childId: child.id,
        fullName: String(fd.get("fullName") ?? ""),
        birthDate: String(fd.get("birthDate") ?? ""),
        allergies: String(fd.get("allergies") ?? ""),
        healthNotes: String(fd.get("healthNotes") ?? ""),
        specialNeeds: String(fd.get("specialNeeds") ?? ""),
        emergencyName: String(fd.get("emergencyName") ?? ""),
        emergencyPhone: String(fd.get("emergencyPhone") ?? ""),
        photoConsent,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Cadastro atualizado");
      router.refresh();
    });
  }

  return (
    <form action={saveChild} className="space-y-4 rounded-3xl border p-5">
      <div>
        <h2 className="font-semibold">Dados da criança</h2>
        <p className="text-sm text-muted-foreground">
          Atualize informações de cuidado, saúde e emergência.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input id="fullName" name="fullName" defaultValue={child.fullName} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthDate">Data de nascimento</Label>
        <Input id="birthDate" name="birthDate" type="date" defaultValue={child.birthDate} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="allergies">Alergias / restrições</Label>
        <Input id="allergies" name="allergies" defaultValue={child.allergies ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="healthNotes">Condição de saúde / medicação</Label>
        <Input id="healthNotes" name="healthNotes" defaultValue={child.healthNotes ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="specialNeeds">Necessidades especiais</Label>
        <Input id="specialNeeds" name="specialNeeds" defaultValue={child.specialNeeds ?? ""} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="emergencyName">Contato de emergência</Label>
          <Input id="emergencyName" name="emergencyName" defaultValue={child.emergencyName ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyPhone">Telefone</Label>
          <Input id="emergencyPhone" name="emergencyPhone" defaultValue={child.emergencyPhone ?? ""} />
        </div>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <Checkbox
          checked={photoConsent}
          onChange={(event) => setPhotoConsent(event.target.checked)}
          className="size-5"
        />
        Autoriza uso de imagem da criança
      </label>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}
