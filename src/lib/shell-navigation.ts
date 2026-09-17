export type ShellNavItemId =
  | "home"
  | "agenda"
  | "times"
  | "escalas"
  | "assistente"
  | "perfil"
  | "pessoas"
  | "distribuicao"
  | "equipamentos"
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
      { id: "times", href: "/infantil", label: "Meus filhos" },
      { id: "perfil", href: "/perfil", label: "Perfil" },
    ];
  }

  return [
    { id: "home", href: "", label: "Início" },
    { id: "agenda", href: "/escalas?filtro=todas", label: "Agenda" },
    { id: "times", href: "/times", label: "Times" },
    { id: "escalas", href: "/escalas?filtro=minhas", label: "Escalas" },
    ...(isLeader
      ? [
          { id: "assistente" as const, href: "/assistente", label: "Assistente LUNOR" },
          { id: "pessoas" as const, href: "/pessoas", label: "Equipe" },
          { id: "distribuicao" as const, href: "/distribuicao", label: "Distribuição" },
          { id: "equipamentos" as const, href: "/equipamentos", label: "Equipamentos" },
        ]
      : []),
    { id: "perfil", href: "/perfil", label: "Perfil" },
    ...(canAdmin
      ? [{ id: "admin" as const, href: "/admin", label: "Administração" }]
      : []),
  ];
}
