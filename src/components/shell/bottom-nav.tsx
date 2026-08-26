"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Baby, Calendar, Guitar, Home, Music2, User, Users, Wrench } from "lucide-react";
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
    { href: "/equipamentos", label: "Instrumentos", icon: Guitar, badge: 0 },
    ...(isLeader ? [
      { href: "/manutencoes", label: "Manutenções", icon: Wrench, badge: 0 },
      { href: "/pessoas", label: "Equipe", icon: Users, badge: 0 },
    ] : []),
    { href: "/perfil", label: "Perfil", icon: User, badge: 0 },
  ];

  return (
    <nav aria-label="Navegação principal" className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-1rem)] max-w-md -translate-x-1/2 md:hidden">
      <div className="grid h-16 w-full grid-flow-col auto-cols-fr items-center gap-1 rounded-2xl border border-foreground/15 bg-background/92 p-1.5 shadow-xl shadow-black/15 backdrop-blur-xl dark:shadow-black/40">
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
                "relative flex h-13 min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl transition-colors duration-200",
                active ? "bg-[#6e5ce6] text-white shadow-sm" : "text-muted-foreground hover:bg-foreground/8 hover:text-foreground"
              )}
            >
              <Icon className="size-[19px] shrink-0" strokeWidth={active ? 2.25 : 1.75} />
              <span className="sr-only">{label}</span>
              {badge > 0 && (
                <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white">
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
