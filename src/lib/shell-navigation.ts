export type ShellNavItemId =
  | "home"
  | "louvor"
  | "kids"
  | "ministry"
  | "escalas"
  | "perfil"
  | "pessoas"
  | "admin";

export type ShellNavItem = {
  id: ShellNavItemId;
  href: string;
  label: string;
};

export type ActiveMinistryNavigation = {
  href: string;
  label: string;
  module: "generic";
} | null;

export function buildShellNavigation({
  guardianOnly,
  hasLouvor,
  hasKids,
  activeMinistryNavigation,
  isLeader,
  canAdmin,
}: {
  guardianOnly: boolean;
  hasLouvor: boolean;
  hasKids: boolean;
  activeMinistryNavigation: ActiveMinistryNavigation;
  isLeader: boolean;
  canAdmin: boolean;
}): ShellNavItem[] {
  if (guardianOnly) {
    return [
      { id: "kids", href: "/infantil", label: "Meus filhos" },
      { id: "perfil", href: "/perfil", label: "Perfil" },
    ];
  }

  return [
    { id: "home", href: "", label: "Visão geral" },
    ...(hasLouvor
      ? [{ id: "louvor" as const, href: "/louvor", label: "Louvor" }]
      : []),
    ...(hasKids
      ? [{ id: "kids" as const, href: "/infantil", label: "Kids" }]
      : []),
    ...(activeMinistryNavigation
      ? [
          {
            id: "ministry" as const,
            href: activeMinistryNavigation.href,
            label: activeMinistryNavigation.label,
          },
        ]
      : []),
    { id: "escalas", href: "/escalas", label: "Cultos e escalas" },
    { id: "perfil", href: "/perfil", label: "Perfil" },
    ...(isLeader
      ? [{ id: "pessoas" as const, href: "/pessoas", label: "Equipe" }]
      : []),
    ...(canAdmin
      ? [{ id: "admin" as const, href: "/admin", label: "Administração" }]
      : []),
  ];
}
