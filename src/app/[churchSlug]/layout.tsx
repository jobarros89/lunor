import { LogOut } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { getActiveMinistry } from "@/lib/ministry";
import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/shell/bottom-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { SectorSwitcher } from "@/components/shell/sector-switcher";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { SessionKeeper } from "@/components/shell/session-keeper";
import { BrandLockup } from "@/components/brand-lockup";

function ministryNavigation(ministry: { name: string; slug: string } | null) {
  if (!ministry) return null;
  const slug = ministry.slug.toLocaleLowerCase("pt-BR");
  const name = ministry.name.toLocaleLowerCase("pt-BR");
  if (slug === "louvor" || name.includes("louvor")) return { href: "/louvor", label: "Repertório", module: "louvor" as const };
  if (slug === "infantil" || name.includes("infantil")) return { href: "/infantil", label: ministry.name, module: "infantil" as const };
  return null;
}

export default async function TenantLayout({ children, params }: { children: React.ReactNode; params: Promise<{ churchSlug: string }> }) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const { active, options } = await getActiveMinistry(churchSlug);
  const activeMinistryNavigation = ministryNavigation(active);
  const supabase = await createClient();
  const { count: escalasPending } = await supabase
    .from("assignments")
    .select("id, events!inner(starts_at)", { count: "exact", head: true })
    .eq("user_id", tenant.userId)
    .eq("church_id", tenant.church.id)
    .eq("status", "convidado")
    .gte("events.starts_at", new Date().toISOString());
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const initials = tenant.profile.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-dvh">
      <SessionKeeper />
      <Sidebar churchSlug={churchSlug} churchName={tenant.church.name} canAdmin={tenant.isCoord} isLeader={tenant.isLeader} activeMinistryNavigation={activeMinistryNavigation} escalasPending={escalasPending ?? 0} />
      <div className="md:pl-60">
        <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/88 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-[max(1rem,env(safe-area-inset-left))] md:px-8">
            <BrandLockup compact className="md:hidden" />
            <Avatar className="hidden size-9 md:flex">
              <AvatarImage src={tenant.profile.avatar_url ?? undefined} />
              <AvatarFallback className="bg-foreground text-xs font-semibold text-background">{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 md:block">
              <p className="truncate text-sm font-medium">{tenant.profile.full_name}</p>
              <p className="text-[10px] capitalize tracking-wide text-muted-foreground">{today}</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              {active && <SectorSwitcher churchSlug={churchSlug} activeId={active.id} options={options} />}
              <ThemeToggle />
              <form action={signOut}>
                <Button type="submit" variant="ghost" className="h-10 rounded-none px-3" aria-label="Sair" title="Sair"><LogOut className="size-4" /><span className="hidden lg:inline">Sair</span></Button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 pb-32 pt-4 md:px-8 md:pb-12">{children}</main>
      </div>
      <BottomNav churchSlug={churchSlug} isLeader={tenant.isLeader} activeMinistryNavigation={activeMinistryNavigation} escalasPending={escalasPending ?? 0} />
    </div>
  );
}
