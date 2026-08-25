"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Baby, Calendar, Camera, Home, Music2, User, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav({ churchSlug, isLeader, activeMinistryNavigation, escalasPending = 0 }: {
  churchSlug: string;
  isLeader: boolean;
  activeMinistryNavigation: { href: string; label: string; module: "louvor" | "infantil" } | null;
  escalasPending?: number;
}) {
  const pathname = usePathname();
  const ministryItem = activeMinistryNavigation ? {
    ...activeMinistryNavigation,
    icon: activeMinistryNavigation.module === "louvor" ? Music2 : Baby,
    badge: 0,
  } : null;
  const items = [
    { href: "", label: "Início", icon: Home, badge: 0 },
    ...(ministryItem ? [ministryItem] : []),
    { href: "/escalas", label: "Escalas", icon: Calendar, badge: escalasPending },
    { href: "/equipamentos", label: "Recursos", icon: Camera, badge: 0 },
    ...(isLeader ? [
      { href: "/manutencoes", label: "Manutenções", icon: Wrench, badge: 0 },
      { href: "/pessoas", label: "Equipe", icon: Users, badge: 0 },
    ] : []),
    { href: "/perfil", label: "Perfil", icon: User, badge: 0 },
  ];

  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-50 px-2 md:hidden">
      <div className="mx-auto grid h-14 w-full max-w-md grid-flow-col auto-cols-fr items-center gap-0.5 rounded-2xl border border-white/10 bg-zinc-950/92 p-1 shadow-xl shadow-black/25 backdrop-blur-xl">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const full = `/${churchSlug}${href}`;
          const active = href === "" ? pathname === full : pathname.startsWith(full);
          return (
            <Link
              key={label}
              href={full}
              aria-label={badge > 0 ? `${label} (${badge} pendente)` : label}
              aria-current={active ? "page" : undefined}
              title={label}
              className={cn(
                "relative flex h-11 min-w-0 items-center justify-center rounded-xl transition-colors",
                active ? "bg-[#d8ff00] text-black" : "text-zinc-400 hover:bg-white/8 hover:text-white"
              )}
            >
              <Icon className="size-[19px] shrink-0" strokeWidth={active ? 2.25 : 1.75} />
              <span className="sr-only">{label}</span>
              {badge > 0 && (
                <span className="absolute right-[18%] top-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
