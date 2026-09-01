"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck2, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

export function KidsModuleNav({ churchSlug }: { churchSlug: string }) {
  const pathname = usePathname();

  if (pathname.includes("/infantil/sessao/") || pathname.includes("/infantil/retirada/")) {
    return null;
  }

  const items = [
    {
      href: `/${churchSlug}/infantil`,
      label: "Visão geral",
      icon: LayoutDashboard,
      active: pathname === `/${churchSlug}/infantil`,
    },
    {
      href: `/${churchSlug}/infantil/disponibilidade`,
      label: "Disponibilidade",
      icon: CalendarCheck2,
      active: pathname.startsWith(`/${churchSlug}/infantil/disponibilidade`),
    },
  ];

  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b" aria-label="Conteúdo do Kids">
      {items.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-medium transition",
            active
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
