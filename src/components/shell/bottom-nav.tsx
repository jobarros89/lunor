"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Baby, Calendar, Home, Music2, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav({
  churchSlug,
  hasLouvor = false,
  hasKids = false,
  escalasPending = 0,
}: {
  churchSlug: string;
  hasLouvor?: boolean;
  hasKids?: boolean;
  escalasPending?: number;
}) {
  const pathname = usePathname();
  const items = [
    { href: "", label: "Início", icon: Home, badge: 0 },
    ...(hasLouvor
      ? [{ href: "/louvor", label: "Louvor", icon: Music2, badge: 0 }]
      : []),
    ...(hasKids
      ? [{ href: "/infantil", label: "Kids", icon: Baby, badge: 0 }]
      : []),
    { href: "/escalas", label: "Escalas", icon: Calendar, badge: escalasPending },
    { href: "/perfil", label: "Perfil", icon: User, badge: 0 },
  ];

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-foreground/12 bg-background/96 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto grid h-16 w-full grid-flow-col auto-cols-fr items-center gap-1 px-2">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const full = `/${churchSlug}${href}`;
          const active = href === "" ? pathname === full : pathname.startsWith(full);
          return (
            <Link
              key={`${href}-${label}`}
              href={full}
              aria-label={badge > 0 ? `${label} (${badge} pendente)` : label}
              aria-current={active ? "page" : undefined}
              title={label}
              className={cn(
                "relative flex h-12 min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl transition-colors duration-200",
                active
                  ? "bg-[#6e5ce6]/12 text-[#6e5ce6]"
                  : "text-muted-foreground hover:bg-foreground/8 hover:text-foreground"
              )}
            >
              <Icon className="size-[21px] shrink-0" strokeWidth={active ? 2.35 : 1.8} />
              <span className="sr-only">{label}</span>
              {badge > 0 && (
                <span className="absolute right-1 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white">
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
