"use client";

import { SectionNav } from "@/components/ui/section-nav";
import { usePathname } from "next/navigation";
import {
  CalendarCheck2,
  CalendarDays,
  LayoutDashboard,
  Settings2,
  UserPlus,
  Users,
} from "lucide-react";

export function KidsSectionNav({
  churchSlug,
  canManageSettings = false,
}: {
  churchSlug: string;
  canManageSettings?: boolean;
}) {
  const pathname = usePathname();
  const registerActive = pathname.includes(`/${churchSlug}/infantil/nova`);
  const scalesActive = pathname.includes(`/${churchSlug}/infantil/escalas`);
  const availabilityActive = pathname.includes(`/${churchSlug}/infantil/disponibilidade`);
  const guardiansActive = pathname.includes(`/${churchSlug}/infantil/responsaveis`);
  const settingsActive = pathname.includes(`/${churchSlug}/infantil/configuracoes`);

  const items = [
    {
      key: "visao",
      label: "Visão",
      href: `/${churchSlug}/infantil`,
      icon: <LayoutDashboard className="size-4" />,
      active:
        !registerActive &&
        !scalesActive &&
        !availabilityActive &&
        !guardiansActive &&
        !settingsActive,
      visible: true,
    },
    {
      key: "cadastrar",
      label: "Cadastrar",
      href: `/${churchSlug}/infantil/nova`,
      icon: <UserPlus className="size-4" />,
      active: registerActive,
      visible: true,
    },
    {
      key: "escalas",
      label: "Escalas",
      href: `/${churchSlug}/infantil/escalas`,
      icon: <CalendarDays className="size-4" />,
      active: scalesActive,
      visible: true,
    },
    {
      key: "disponibilidade",
      label: "Disponibilidade",
      href: `/${churchSlug}/infantil/disponibilidade`,
      icon: <CalendarCheck2 className="size-4" />,
      active: availabilityActive,
      visible: true,
    },
    {
      key: "responsaveis",
      label: "Responsáveis",
      href: `/${churchSlug}/infantil/responsaveis`,
      icon: <Users className="size-4" />,
      active: guardiansActive,
      visible: true,
    },
    {
      key: "configuracoes",
      label: "Configurações",
      href: `/${churchSlug}/infantil/configuracoes`,
      icon: <Settings2 className="size-4" />,
      active: settingsActive,
      visible: canManageSettings,
    },
  ];

  return <SectionNav label="Áreas do Kids" items={items.filter((item) => item.visible)} />;
}
