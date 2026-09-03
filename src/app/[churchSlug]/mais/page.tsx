import Link from "next/link";
import { redirect } from "next/navigation";
import { Baby, Calendar, ChevronRight, Home, Music2, Settings, User, Users } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { getActiveMinistry } from "@/lib/ministry";
import { createClient } from "@/lib/supabase/server";
import { buildShellNavigation, type ShellNavItemId } from "@/lib/shell-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteLink } from "@/components/invite-link";

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

const ICONS: Record<ShellNavItemId, React.ComponentType<{ className?: string }>> = {
  home: Home,
  louvor: Music2,
  kids: Baby,
  ministry: Users,
  escalas: Calendar,
  perfil: User,
  pessoas: Users,
  admin: Settings,
};

export default async function MaisPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  if (tenant.guardianOnly) redirect(`/${churchSlug}/perfil`);

  const { active, options } = await getActiveMinistry(churchSlug);
  const hasLouvor = options.some(isLouvorMinistry);
  const hasKids = tenant.isGuardian || options.some(isKidsMinistry);
  const activeMinistryNavigation = active && !isLouvorMinistry(active) && !isKidsMinistry(active)
    ? {
        href: `/disponibilidade?ministry=${active.id}`,
        label: active.name,
        module: "generic" as const,
      }
    : null;

  const nav = buildShellNavigation({
    guardianOnly: false,
    hasLouvor,
    hasKids,
    activeMinistryNavigation,
    isLeader: tenant.isLeader,
    canAdmin: tenant.isCoord,
  });

  const supabase = await createClient();
  const { data: inviteCode } = tenant.role === "admin"
    ? await supabase.rpc("get_church_invite_code", { p_church: tenant.church.id })
    : { data: null };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Navegação
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Todos os acessos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No mobile, nada fica exclusivo do menu lateral da versão web.
        </p>
      </div>

      {tenant.role === "admin" && inviteCode && (
        <Card className="rounded-3xl border-[#6e5ce6]/35 bg-[#6e5ce6]/8">
          <CardHeader>
            <CardTitle className="text-base">Convidar pessoa</CardTitle>
            <CardDescription>
              Compartilhe o convite da igreja para novos voluntários e integrantes da equipe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteLink inviteCode={inviteCode} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {nav.map((item) => {
          const Icon = ICONS[item.id];
          const description = item.id === "pessoas"
            ? "Pessoas, funções e permissões da equipe"
            : item.id === "admin"
              ? "Configurações, campi, convite e gestão da igreja"
              : item.id === "perfil"
                ? "Perfil, notificações e seus dados"
                : item.id === "escalas"
                  ? "Cultos, convites e suas próximas escalas"
                  : item.id === "ministry"
                    ? "Disponibilidade e visão do ministério ativo"
                    : `Abrir ${item.label}`;

          return (
            <Link key={`${item.id}-${item.href}`} href={`/${churchSlug}${item.href}`} className="block">
              <Card className="h-full rounded-3xl transition-colors hover:bg-accent/40">
                <CardContent className="flex items-center gap-4 py-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.label}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
