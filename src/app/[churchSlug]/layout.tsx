import { LogOut } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { getActiveMinistry } from "@/lib/ministry";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/shell/bottom-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { SessionKeeper } from "@/components/shell/session-keeper";
import { BrandLockup } from "@/components/brand-lockup";
import { KidsNoticeBanner, type KidsPersonalNotice } from "@/components/infantil/kids-notice-banner";

function isKidsMinistry(ministry: { name: string; slug: string }) {
  const slug = ministry.slug.toLocaleLowerCase("pt-BR");
  const name = ministry.name.toLocaleLowerCase("pt-BR");
  return ["kids", "infantil", "criancas", "crianças"].includes(slug)
    || name.includes("kids")
    || name.includes("infantil")
    || name.includes("crianças")
    || name.includes("criancas");
}

function isLouvorMinistry(ministry: { name: string; slug: string }) {
  const slug = ministry.slug.toLocaleLowerCase("pt-BR");
  const name = ministry.name.toLocaleLowerCase("pt-BR");
  return slug === "louvor" || name.includes("louvor");
}

function ministryNavigation(ministry: { name: string; slug: string } | null) {
  if (!ministry) return null;
  if (isLouvorMinistry(ministry)) return { href: "/louvor", label: "Louvor", module: "louvor" as const };
  if (isKidsMinistry(ministry)) return { href: "/infantil", label: "Kids", module: "infantil" as const };
  return null;
}

export default async function TenantLayout({ children, params }: { children: React.ReactNode; params: Promise<{ churchSlug: string }> }) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const { active, options } = await getActiveMinistry(churchSlug);
  const activeMinistryNavigation = ministryNavigation(active);
  const hasLouvor = options.some(isLouvorMinistry);
  const hasKids = tenant.isGuardian || options.some(isKidsMinistry);
  const supabase = await createClient();
  const [{ count: escalasPending }, { data: kidsNotices }] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, events!inner(starts_at)", { count: "exact", head: true })
      .eq("user_id", tenant.userId)
      .eq("church_id", tenant.church.id)
      .eq("status", "convidado")
      .gte("events.starts_at", new Date().toISOString()),
    supabase.rpc("meus_anuncios_infantil", { p_church: tenant.church.id }),
  ]);
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const initials = tenant.profile.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="relative h-dvh w-full max-w-full overflow-hidden md:h-auto md:min-h-dvh md:overflow-x-clip">
      <SessionKeeper />
      <Sidebar churchSlug={churchSlug} churchName={tenant.church.name} canAdmin={tenant.isCoord} isLeader={tenant.isLeader} activeMinistryNavigation={activeMinistryNavigation} hasKids={hasKids} escalasPending={escalasPending ?? 0} guardianOnly={tenant.guardianOnly} />
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
              <p className="text-[10px] capitalize tracking-wide text-muted-foreground">{today}</p>
            </div>
            <div className="ml-auto flex min-w-0 items-center gap-1">
              <ThemeToggle />
              <form action="/auth/logout" method="post">
                <Button type="submit" variant="ghost" className="h-10 rounded-none px-3" aria-label="Sair" title="Sair"><LogOut className="size-4" /><span className="hidden lg:inline">Sair</span></Button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-7xl overflow-x-clip px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-12">
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
      />
    </div>
  );
}

