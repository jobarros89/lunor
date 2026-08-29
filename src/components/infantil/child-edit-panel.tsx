"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addGuardian } from "@/lib/actions/infantil";
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
  const [adding, startAdding] = useTransition();
  const [photoConsent, setPhotoConsent] = useState(child.photoConsent);
  const [canPickup, setCanPickup] = useState(true);
  const campo = "h-11 rounded-xl";

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

  function addResponsible(fd: FormData) {
    startAdding(async () => {
      const result = await addGuardian({
        churchSlug,
        churchId,
        ministryId,
        childId: child.id,
        fullName: String(fd.get("guardianName") ?? ""),
        phone: String(fd.get("guardianPhone") ?? ""),
        relationship: String(fd.get("relationship") ?? ""),
        canPickup,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Responsável adicionado");
      const form = document.getElementById("add-kids-guardian") as HTMLFormElement | null;
      form?.reset();
      setCanPickup(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form action={saveChild} className="space-y-4 rounded-3xl border p-5">
        <div>
          <h2 className="font-semibold">Dados da criança</h2>
          <p className="text-sm text-muted-foreground">Atualize informações de cuidado e emergência.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input id="fullName" name="fullName" defaultValue={child.fullName} required className={campo} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="birthDate">Data de nascimento</Label>
          <Input id="birthDate" name="birthDate" type="date" defaultValue={child.birthDate} required className={campo} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="allergies">Alergias / restrições</Label>
          <Input id="allergies" name="allergies" defaultValue={child.allergies ?? ""} className={campo} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="healthNotes">Condição de saúde / medicação</Label>
          <Input id="healthNotes" name="healthNotes" defaultValue={child.healthNotes ?? ""} className={campo} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="specialNeeds">Necessidades especiais</Label>
          <Input id="specialNeeds" name="specialNeeds" defaultValue={child.specialNeeds ?? ""} className={campo} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="emergencyName">Contato de emergência</Label>
            <Input id="emergencyName" name="emergencyName" defaultValue={child.emergencyName ?? ""} className={campo} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyPhone">Telefone</Label>
            <Input id="emergencyPhone" name="emergencyPhone" defaultValue={child.emergencyPhone ?? ""} className={campo} />
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={photoConsent} onChange={(event) => setPhotoConsent(event.target.checked)} className="size-5" />
          Autoriza uso de imagem da criança
        </label>
        <Button type="submit" disabled={saving} className="h-11 w-full rounded-full">
          {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </form>

      <form id="add-kids-guardian" action={addResponsible} className="space-y-4 rounded-3xl border p-5">
        <div>
          <h2 className="font-semibold">Adicionar responsável</h2>
          <p className="text-sm text-muted-foreground">Inclua mãe, pai, familiar ou outra pessoa autorizada.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="guardianName">Nome do responsável</Label>
          <Input id="guardianName" name="guardianName" required className={campo} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="relationship">Parentesco</Label>
            <Input id="relationship" name="relationship" placeholder="mãe, irmã, avó…" className={campo} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guardianPhone">Telefone</Label>
            <Input id="guardianPhone" name="guardianPhone" className={campo} />
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={canPickup} onChange={(event) => setCanPickup(event.target.checked)} className="size-5" />
          Autorizado a retirar a criança
        </label>
        <Button type="submit" disabled={adding} variant="outline" className="h-11 w-full rounded-full">
          {adding ? "Adicionando…" : "+ Adicionar responsável"}
        </Button>
      </form>
    </div>
  );
}
