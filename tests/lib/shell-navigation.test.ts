import { describe, expect, it } from "vitest";
import { buildShellNavigation } from "@/lib/shell-navigation";

describe("buildShellNavigation", () => {
  it("inclui todos os acessos de líder/admin que também precisam existir no mobile", () => {
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

    expect(nav.map((item) => item.id)).toEqual([
      "home",
      "louvor",
      "kids",
      "ministry",
      "escalas",
      "assistente",
      "pessoas",
      "distribuicao",
      "equipamentos",
      "perfil",
      "admin",
    ]);
    expect(nav.find((item) => item.id === "ministry")?.href).toBe(
      "/disponibilidade?ministry=abc"
    );
  });

  it("não expõe gestão nem assistente para voluntário sem permissão", () => {
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
      "louvor",
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
      { id: "kids", href: "/infantil", label: "Meus filhos" },
      { id: "perfil", href: "/perfil", label: "Perfil" },
    ]);
  });
});
