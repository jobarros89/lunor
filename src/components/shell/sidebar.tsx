"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Baby, Calendar, Home, Music2, PanelLeftClose, PanelLeftOpen, Settings, Sparkles, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildShellNavigation, type ActiveMinistryNavigation, type ShellNavItemId } from "@/lib/shell-navigation";
import { BrandLockup } from "@/components/brand-lockup";
import { SIDEBAR_ATTRIBUTE, SIDEBAR_STORAGE_KEY } from "@/components/shell/sidebar-state";

const SIDEBAR_EVENT = "lunor:sidebar-state";

const ICONS: Record<ShellNavItemId, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  home: Home,
  louvor: Music2,
  kids: Baby,
  ministry: Users,
  escalas: Calendar,
  assistente: Sparkles,
  perfil: User,
  pessoas: Users,
  admin: Settings,
};

function getSidebarSnapshot() {
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}

function getSidebarServerSnapshot() {
  return false;
}

function subscribeSidebar(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SIDEBAR_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SIDEBAR_EVENT, callback);
  };
}

export function Sidebar({ churchSlug, churchName, canAdmin, isLeader, activeMinistryNavigation, hasLouvor = false, hasKids = false, escalasPending = 0, guardianOnly = false }: {
  churchSlug: string;
  churchName: string;
  canAdmin: boolean;
  isLeader: boolean;
  activeMinistryNavigation: ActiveMinistryNavigation;
  hasLouvor?: boolean;
  hasKids?: boolean;
  escalasPending?: number;
  guardianOnly?: boolean;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot
  );

  useEffect(() => {
    document.documentElement.setAttribute(SIDEBAR_ATTRIBUTE, String(collapsed));
    return () => document.documentElement.removeAttribute(SIDEBAR_ATTRIBUTE);
  }, [collapsed]);

  function toggleSidebar() {
    const next = !collapsed;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  }

  const nav = buildShellNavigation({
    guardianOnly,
    hasLouvor,
    hasKids,
    activeMinistryNavigation,
    isLeader,
    canAdmin,
  });

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-black/10 bg-[#f8f8f5]/95 py-7 backdrop-blur-xl transition-[width,padding] duration-200 md:flex dark:border-white/10 dark:bg-[#111]/95",
        collapsed ? "w-16 px-2" : "w-60 px-5"
      )}
    >
      <div className={cn("mb-8", collapsed ? "px-0" : "px-2")}>
        <div className={cn("flex items-start", collapsed ? "justify-center" : "justify-between gap-2")}>
          <Link
            href={`/${churchSlug}`}
            aria-label="Ir para o início"
            title={collapsed ? "LUNOR" : undefined}
            className="inline-block min-w-0 transition-opacity hover:opacity-70"
          >
            {collapsed ? (
              <span className="flex size-9 items-center justify-center text-sm font-semibold tracking-[0.18em]">L</span>
            ) : (
              <BrandLockup />
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Recolher menu lateral"
              title="Recolher menu"
            >
              <PanelLeftClose className="size-4" strokeWidth={1.7} />
            </button>
          )}
        </div>
        {!collapsed && (
          <p className="mt-2 truncate text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{churchName}</p>
        )}
      </div>

      <nav className="flex flex-col gap-1">
        {nav.map(({ id, href, label }) => {
          const Icon = ICONS[id];
          const full = `/${churchSlug}${href}`;
          const pathOnly = full.split("?")[0];
          const active = href === "" ? pathname === pathOnly : pathname.startsWith(pathOnly);
          return (
            <Link
              key={`${href}-${label}`}
              href={full}
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              className={cn(
                "group relative flex min-h-11 items-center border-l-2 py-2.5 text-sm transition-colors",
                collapsed ? "justify-center px-2" : "gap-3 px-3",
                active
                  ? "border-[#d8ff00] bg-black text-white dark:bg-white dark:text-black"
                  : "border-transparent text-muted-foreground hover:border-foreground/25 hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.7} />
              {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
              {id === "escalas" && escalasPending > 0 && (
                <span
                  className={cn(
                    "flex min-w-5 items-center justify-center bg-[#d8ff00] px-1.5 text-[10px] font-bold text-black",
                    collapsed && "absolute right-0.5 top-0.5 min-w-4 px-1 text-[9px]"
                  )}
                >
                  {escalasPending > 9 ? "9+" : escalasPending}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {collapsed && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="mt-auto flex min-h-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Expandir menu lateral"
          title="Expandir menu"
        >
          <PanelLeftOpen className="size-4" strokeWidth={1.7} />
        </button>
      )}
    </aside>
  );
}
