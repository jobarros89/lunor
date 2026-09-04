"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck2,
  CalendarDays,
  LayoutDashboard,
  Settings2,
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
      active: !scalesActive && !availabilityActive && !guardiansActive && !settingsActive,
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

  return (
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Áreas do Kids">
      {items.filter((item) => item.visible).map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`flex h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-medium transition ${
            item.active
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
