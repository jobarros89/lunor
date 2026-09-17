"use client";

import { SectionNav } from "@/components/ui/section-nav";
import { usePathname } from "next/navigation";
import { CalendarCheck2, CalendarDays, LayoutDashboard } from "lucide-react";

export function LouvorSectionNav({ churchSlug }: { churchSlug: string }) {
  const pathname = usePathname();
  const scalesActive = pathname.includes(`/${churchSlug}/louvor/escalas`);
  const availabilityActive = pathname.includes(`/${churchSlug}/louvor/disponibilidade`);

  const items = [
    {
      key: "visao",
      label: "Visão",
      href: `/${churchSlug}/louvor`,
      icon: <LayoutDashboard className="size-4" />,
      active: !scalesActive && !availabilityActive,
    },
    {
      key: "escalas",
      label: "Escalas",
      href: `/${churchSlug}/louvor/escalas`,
      icon: <CalendarDays className="size-4" />,
      active: scalesActive,
    },
    {
      key: "disponibilidade",
      label: "Disponibilidade",
      href: `/${churchSlug}/louvor/disponibilidade`,
      icon: <CalendarCheck2 className="size-4" />,
      active: availabilityActive,
    },
  ];

  return <SectionNav label="Áreas do Louvor" items={items} />;
}
