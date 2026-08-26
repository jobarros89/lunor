"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Baby, BookOpen, Calendar, Camera, Home, Music2, Settings, User, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLockup } from "@/components/brand-lockup";

export function Sidebar({ churchSlug, churchName, canAdmin, isLeader, activeMinistryNavigation, escalasPending = 0 }: {
  churchSlug: string;
  churchName: string;
  canAdmin: boolean;
  isLeader: boolean;
  activeMinistryNavigation: { href: string; label: string; module: "louvor" | "infantil" } | null;
  escalasPending?: number;
}) {
  const pathname = usePathname();
  const ministryItem = activeMinistryNavigation ? {
    ...activeMinistryNavigation,
    icon: activeMinistryNavigation.module === "louvor" ? Music2 : Baby,
  } : null;
  const nav = [
    { href: "", label: "Visão geral", icon: Home },
    ...(ministryItem ? [ministryItem] : []),
    { href: "/escalas", label: "Cultos e escalas", icon: Calendar },
    { href: "/equipamentos", label: "Recursos", icon: Camera },
    { href: "/perfil", label: "Perfil", icon: User },
    ...(isLeader ? [
      { href: "/pessoas", label: "Equipe", icon: Users },
      { href: "/manutencoes", label: "Manutenções", icon: Wrench },
    ] : []),
    ...(canAdmin ? [{ href: "/admin", label: "Administração", icon: Settings }] : []),
    { href: "/guia", label: "Guia", icon: BookOpen },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-black/10 bg-[#f8f8f5]/95 px-5 py-7 backdrop-blur-xl md:flex dark:border-white/10 dark:bg-[#111]/95">
      <div className="mb-10 px-2">
        <Link href={`/${churchSlug}`} aria-label="Ir para o início" className="inline-block transition-opacity hover:opacity-70">
          <BrandLockup />
        </Link>
        <p className="mt-2 truncate text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{churchName}</p>
      </div>
      <nav className="flex flex-col gap-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const full = `/${churchSlug}${href}`;
          const active = href === "" ? pathname === full : pathname.startsWith(full);
          return (
            <Link key={label} href={full} className={cn(
              "group flex min-h-11 items-center gap-3 border-l-2 px-3 py-2.5 text-sm transition-colors",
              active ? "border-[#d8ff00] bg-black text-white dark:bg-white dark:text-black" : "border-transparent text-muted-foreground hover:border-foreground/25 hover:text-foreground"
            )}>
              <Icon className="size-4" strokeWidth={1.7} />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {href === "/escalas" && escalasPending > 0 && (
                <span className="flex min-w-5 items-center justify-center bg-[#d8ff00] px-1.5 text-[10px] font-bold text-black">
                  {escalasPending > 9 ? "9+" : escalasPending}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
