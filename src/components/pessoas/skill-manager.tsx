"use client";

import { Select } from "@/components/ui/select";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { approveSkill, removeSkill } from "@/lib/actions/pessoas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type MemberSkill = {
  skill_id: string;
  source: "experience" | "training" | "both";
  approved_by: string | null;
  skill_name: string;
};

type Skill = { id: string; name: string };

const SOURCE_LABELS = {
  experience: "Experiência",
  training: "Treinamento",
  both: "Experiência + Treinamento",
} as const;

export function SkillManager({
  churchSlug,
  churchId,
  userId,
  memberSkills,
  allSkills,
  canManage,
}: {
  churchSlug: string;
  churchId: string;
  userId: string;
  memberSkills: MemberSkill[];
  allSkills: Skill[];
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [newSkillId, setNewSkillId] = useState("");
  const [newSource, setNewSource] = useState<"experience" | "training" | "both">(
    "experience"
  );

  const availableSkills = allSkills.filter(
    (s) => !memberSkills.some((ms) => ms.skill_id === s.id)
  );

  function act(fn: () => Promise<{ ok: boolean; error?: string } | void>) {
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok) toast.error(result.error ?? "Erro");
    });
  }

  return (
    <div className="space-y-4">
      {memberSkills.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma aptidão registrada.
        </p>
      )}

      <div className="space-y-2">
        {memberSkills.map((ms) => (
          <div
            key={ms.skill_id}
            className="flex items-center justify-between rounded-2xl border px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-medium">{ms.skill_name}</p>
              <p className="text-xs text-muted-foreground">
                {ms.approved_by
                  ? `Apto por ${SOURCE_LABELS[ms.source].toLowerCase()}`
                  : "Sugerido no briefing — aguardando aprovação"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {ms.approved_by ? (
                <Badge >
                  {SOURCE_LABELS[ms.source]}
                </Badge>
              ) : (
                <Badge variant="outline" >
                  Pendente
                </Badge>
              )}
              {canManage && !ms.approved_by && (
                <Button
                  size="sm"
                  disabled={pending}
                  className="h-8"
                  onClick={() =>
                    act(() =>
                      approveSkill({
                        churchSlug,
                        churchId,
                        userId,
                        skillId: ms.skill_id,
                        source: ms.source,
                      })
                    )
                  }
                >
                  Aprovar
                </Button>
              )}
              {canManage && (
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  className="size-9 text-muted-foreground"
                  aria-label={`Remover ${ms.skill_name}`}
                  onClick={() =>
                    act(() =>
                      removeSkill({
                        churchSlug,
                        churchId,
                        userId,
                        skillId: ms.skill_id,
                      })
                    )
                  }
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canManage && availableSkills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed p-3">
          <Select
            value={newSkillId}
            onChange={(e) => setNewSkillId(e.target.value)}
            className="flex-1"
            aria-label="Escolher aptidão"
          >
            <option value="">Marcar apto em…</option>
            {availableSkills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            value={newSource}
            onChange={(e) =>
              setNewSource(e.target.value as typeof newSource)
            }
            className="text-base md:text-sm"
            aria-label="Origem da aptidão"
          >
            <option value="experience">Por experiência</option>
            <option value="training">Por treinamento</option>
            <option value="both">Ambos</option>
          </Select>
          <Button
            size="sm"
            disabled={pending || !newSkillId}
            className="h-10 px-4"
            onClick={() => {
              act(() =>
                approveSkill({
                  churchSlug,
                  churchId,
                  userId,
                  skillId: newSkillId,
                  source: newSource,
                })
              );
              setNewSkillId("");
            }}
          >
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
