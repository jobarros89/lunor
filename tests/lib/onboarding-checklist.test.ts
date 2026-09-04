import { describe, expect, it } from "vitest";
import { buildOnboardingChecklist } from "@/lib/onboarding-checklist";

describe("buildOnboardingChecklist", () => {
  it("igreja recém-criada: nenhum passo concluído", () => {
    const checklist = buildOnboardingChecklist({
      churchSlug: "igreja-nova",
      initialModules: ["teams", "worship"],
      counts: { activeMembers: 1, events: 0, assignments: 0, songs: 0 },
    });

    expect(checklist.allDone).toBe(false);
    expect(checklist.steps.map((step) => step.id)).toEqual(["convidar", "culto", "escala", "musica"]);
    expect(checklist.steps.every((step) => !step.done)).toBe(true);
  });

  it("marca 'convidar' feito quando alguém além do criador entrou", () => {
    const checklist = buildOnboardingChecklist({
      churchSlug: "igreja-nova",
      initialModules: [],
      counts: { activeMembers: 2, events: 0, assignments: 0, songs: 0 },
    });

    expect(checklist.steps.find((step) => step.id === "convidar")?.done).toBe(true);
  });

  it("não inclui o passo de música para quem não escolheu o módulo de Louvor", () => {
    const checklist = buildOnboardingChecklist({
      churchSlug: "igreja-nova",
      initialModules: ["teams", "children"],
      counts: { activeMembers: 5, events: 3, assignments: 10, songs: 0 },
    });

    expect(checklist.steps.map((step) => step.id)).toEqual(["convidar", "culto", "escala"]);
    expect(checklist.allDone).toBe(true);
  });

  it("allDone só é true quando todos os passos aplicáveis estão concluídos", () => {
    const quaseTudo = buildOnboardingChecklist({
      churchSlug: "igreja-nova",
      initialModules: ["worship"],
      counts: { activeMembers: 3, events: 2, assignments: 5, songs: 0 },
    });
    expect(quaseTudo.allDone).toBe(false);

    const tudo = buildOnboardingChecklist({
      churchSlug: "igreja-nova",
      initialModules: ["worship"],
      counts: { activeMembers: 3, events: 2, assignments: 5, songs: 1 },
    });
    expect(tudo.allDone).toBe(true);
  });

  it("gera hrefs escopados pelo slug da igreja", () => {
    const checklist = buildOnboardingChecklist({
      churchSlug: "minha-igreja",
      initialModules: [],
      counts: { activeMembers: 1, events: 0, assignments: 0, songs: 0 },
    });

    expect(checklist.steps.find((step) => step.id === "culto")?.href).toBe("/minha-igreja/escalas/novo");
  });
});
