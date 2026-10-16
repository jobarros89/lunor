import Link from "next/link";
import { LogOut, MessageSquare } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { getActiveMinistry } from "@/lib/ministry";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { BottomNav } from "@/components/shell/bottom-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { SessionKeeper } from "@/components/shell/session-keeper";
import { BrandLockup } from "@/components/brand-lockup";
import { OfflineNotice } from "@/components/shell/offline-notice";
import { KidsNoticeBanner, type KidsPersonalNotice } from "@/components/infantil/kids-notice-banner";

function ministryNavigation(ministry: { id: string; name: string; module_key: "generic" | "worship" | "kids" } | null) {
  if (!ministry || ministry.module_key !== "generic") return null;
  return {
    href: `/disponibilidade?ministry=${ministry.id}`,
    label: ministry.name,
    module: "generic" as const,
  };
}

export default async function TenantLayout({ children, params }: { children: React.ReactNode; params: Promise<{ churchSlug: string }> }) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const { active, options } = await getActiveMinistry(churchSlug);
  const activeMinistryNavigation = ministryNavigation(active);
  const hasLouvor = options.some((ministry) => ministry.module_key === "worship");
  const hasKids = tenant.isGuardian || options.some((ministry) => ministry.module_key === "kids");
  const supabase = await createClient();
  const [
    { count: escalasPending },
    { data: kidsNotices },
    { count: unreadMessages },
  ] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, events!inner(starts_at)", { count: "exact", head: true })
      .eq("user_id", tenant.userId)
      .eq("church_id", tenant.church.id)
      .eq("status", "convidado")
      .gte("events.starts_at", new Date().toISOString()),
    supabase.rpc("meus_anuncios_infantil", { p_church: tenant.church.id }),
    supabase
      .from("inbox_messages")
      .select("id", { count: "exact", head: true })
      .eq("church_id", tenant.church.id)
      .eq("recipient_id", tenant.userId)
      .is("read_at", null),
  ]);
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const initials = tenant.profile.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="relative h-dvh w-full max-w-full overflow-hidden md:h-auto md:min-h-dvh md:overflow-x-clip">
      <a href="#main-content" className="skip-link">Pular para o conteúdo</a>
      <SessionKeeper />
      <Sidebar churchSlug={churchSlug} churchName={tenant.church.name} canAdmin={tenant.isCoord} isLeader={tenant.isLeader} activeMinistryNavigation={activeMinistryNavigation} hasLouvor={hasLouvor} hasKids={hasKids} escalasPending={escalasPending ?? 0} guardianOnly={tenant.guardianOnly} />
      <div className="tenant-shell h-full min-w-0 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] md:h-auto md:overflow-visible md:pl-60">
        <header className="sticky top-0 z-30 w-full max-w-full overflow-x-clip border-b border-foreground/10 bg-background/88 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full min-w-0 max-w-7xl items-center gap-1 px-[max(0.75rem,env(safe-area-inset-left))] sm:gap-3 sm:px-4 md:px-8">
            <BrandLockup compact className="shrink-0 md:hidden" />
            <Avatar className="hidden size-9 md:flex">
              <AvatarImage src={tenant.profile.avatar_url ?? undefined} />
              <AvatarFallback className="bg-foreground text-xs font-semibold text-background">{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 md:block">
              <p className="truncate text-sm font-medium">{tenant.profile.full_name}</p>
              <p className="text-xs capitalize text-muted-foreground">{today}</p>
            </div>
            <div className="ml-auto flex min-w-0 items-center gap-1">
              <Link
                href={`/${churchSlug}/mensagens`}
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon",
                  className: "relative h-10 w-10",
                })}
                aria-label={
                  (unreadMessages ?? 0) > 0
                    ? `Mensagens (${unreadMessages} não lidas)`
                    : "Mensagens"
                }
                title="Mensagens"
              >
                <MessageSquare className="size-4" />
                {(unreadMessages ?? 0) > 0 && (
                  <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-white">
                    {(unreadMessages ?? 0) > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </Link>
              <ThemeToggle />
              <form action="/auth/logout" method="post">
                <Button type="submit" variant="ghost" className="h-10 rounded-lg px-3" aria-label="Sair" title="Sair"><LogOut className="size-4" /><span className="hidden lg:inline">Sair</span></Button>
              </form>
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-7xl overflow-x-clip px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 md:px-8 md:pb-12 md:pt-8">
          <OfflineNotice />
          <KidsNoticeBanner
            churchSlug={churchSlug}
            notices={(kidsNotices ?? []) as KidsPersonalNotice[]}
          />
          {children}
        </main>
      </div>
      <BottomNav
        churchSlug={churchSlug}
        hasLouvor={hasLouvor}
        hasKids={hasKids}
        escalasPending={escalasPending ?? 0}
        guardianOnly={tenant.guardianOnly}
        isLeader={tenant.isLeader}
      />
    </div>
  );
}
