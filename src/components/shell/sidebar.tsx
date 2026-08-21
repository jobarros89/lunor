"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Calendar,
  Camera,
  Home,
  Music2,
  Baby,
  Settings,
  User,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar({
  churchSlug,
  churchName,
  canAdmin,
  isLeader,
  activeMinistryNavigation,
  escalasPending = 0,
}: {
  churchSlug: string;
  churchName: string;
  canAdmin: boolean;
  isLeader: boolean;
  activeMinistryNavigation: {
    href: string;
    label: string;
    module: "louvor" | "infantil";
  } | null;
  escalasPending?: number;
}) {
  const pathname = usePathname();
  const ministryItem = activeMinistryNavigation
    ? {
        ...activeMinistryNavigation,
        icon: activeMinistryNavigation.module === "louvor" ? Music2 : Baby,
      }
    : null;
  const nav = [
    { href: "", label: "Início", icon: Home },
    ...(ministryItem ? [ministryItem] : []),
    { href: "/escalas", label: "Escalas", icon: Calendar },
    { href: "/equipamentos", label: "Equipamentos", icon: Camera },
    { href: "/perfil", label: "Perfil", icon: User },
    ...(isLeader
      ? [
          { href: "/pessoas", label: "Equipe", icon: Users },
          { href: "/manutencoes", label: "Manutenções", icon: Wrench },
        ]
      : []),
    ...(canAdmin
      ? [{ href: "/admin", label: "Administração", icon: Settings }]
      : []),
    { href: "/guia", label: "Guia de uso", icon: BookOpen },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-background p-4 md:flex">
      <div className="mb-8 px-3 py-2">
        <p className="text-lg font-semibold tracking-tight">{churchName}</p>
        <p className="text-xs text-muted-foreground">Acts</p>
      </div>
      <nav className="flex flex-col gap-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const full = `/${churchSlug}${href}`;
          const active =
            href === "" ? pathname === full : pathname.startsWith(full);
          return (
            <Link
              key={label}
              href={full}
              className={cn(
                "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="size-4.5" />
              {label}
              {href === "/escalas" && escalasPending > 0 && (
                <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
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
