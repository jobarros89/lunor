import { describe, expect, it } from "vitest";
import { buildShellNavigation } from "@/lib/shell-navigation";

describe("buildShellNavigation", () => {
  it("usa a arquitetura principal orientada a agenda, times e escalas", () => {
    const nav = buildShellNavigation({
      guardianOnly: false,
      hasLouvor: true,
      hasKids: true,
      activeMinistryNavigation: {
        href: "/disponibilidade?ministry=abc",
        label: "Mídia",
        module: "generic",
      },
      isLeader: true,
      canAdmin: true,
    });

    expect(nav.slice(0, 4)).toEqual([
      { id: "home", href: "", label: "Início" },
      { id: "agenda", href: "/escalas?filtro=todas", label: "Agenda" },
      { id: "times", href: "/times", label: "Times" },
      { id: "escalas", href: "/escalas?filtro=minhas", label: "Escalas" },
    ]);
    expect(nav.map((item) => item.id)).not.toContain("louvor");
    expect(nav.map((item) => item.id)).not.toContain("kids");
  });

  it("mantém ferramentas administrativas fora da navegação do voluntário", () => {
    const nav = buildShellNavigation({
      guardianOnly: false,
      hasLouvor: true,
      hasKids: false,
      activeMinistryNavigation: null,
      isLeader: false,
      canAdmin: false,
    });

    expect(nav.map((item) => item.id)).toEqual([
      "home",
      "agenda",
      "times",
      "escalas",
      "perfil",
    ]);
  });

  it("mantém o fluxo restrito de responsável Kids", () => {
    const nav = buildShellNavigation({
      guardianOnly: true,
      hasLouvor: true,
      hasKids: true,
      activeMinistryNavigation: {
        href: "/disponibilidade?ministry=abc",
        label: "Mídia",
        module: "generic",
      },
      isLeader: true,
      canAdmin: true,
    });

    expect(nav).toEqual([
      { id: "times", href: "/infantil", label: "Meus filhos" },
      { id: "perfil", href: "/perfil", label: "Perfil" },
    ]);
  });
});
