"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Baby, CalendarDays, Home, Menu, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav({
  churchSlug,
  escalasPending = 0,
  guardianOnly = false,
}: {
  churchSlug: string;
  hasLouvor?: boolean;
  hasKids?: boolean;
  escalasPending?: number;
  guardianOnly?: boolean;
  isLeader?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const items = guardianOnly
    ? [
        { href: "/infantil", label: "Meus filhos", icon: Baby, badge: 0 },
        { href: "/mais", label: "Mais", icon: Menu, badge: 0 },
      ]
    : [
        { href: "", label: "Início", icon: Home, badge: 0 },
        { href: "/escalas?filtro=todas", label: "Agenda", icon: CalendarDays, badge: 0 },
        { href: "/times", label: "Times", icon: UsersRound, badge: 0 },
        { href: "/escalas?filtro=minhas", label: "Escalas", icon: CalendarDays, badge: escalasPending },
        { href: "/mais", label: "Mais", icon: Menu, badge: 0 },
      ];

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-50 [backface-visibility:hidden] [transform:translateZ(0)] border-t border-border bg-background/96 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto grid h-16 w-full grid-flow-col auto-cols-fr items-center gap-1 px-2">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const [path, query] = href.split("?");
          const fullPath = `/${churchSlug}${path}`;
          const expectedFilter = query ? new URLSearchParams(query).get("filtro") : null;
          const active =
            path === ""
              ? pathname === fullPath
              : pathname.startsWith(fullPath) &&
                (path !== "/escalas" || searchParams.get("filtro") === expectedFilter);
          return (
            <Link
              key={label}
              href={`/${churchSlug}${href}`}
              aria-label={badge > 0 ? `${label} (${badge} pendente)` : label}
              aria-current={active ? "page" : undefined}
              title={label}
              className={cn(
                "relative flex h-12 min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl transition-colors duration-200",
                active
                  ? "bg-brand-soft text-brand"
                  : "text-muted-foreground hover:bg-foreground/8 hover:text-foreground",
              )}
            >
              <Icon
                className="size-[21px] shrink-0"
                strokeWidth={active ? 2.35 : 1.8}
              />
              <span className="mt-1 max-w-full truncate text-[11px] font-medium leading-none">
                {label}
              </span>
              {badge > 0 && (
                <span className="absolute right-1 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-white">
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
