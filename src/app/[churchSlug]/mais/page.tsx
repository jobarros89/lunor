import Link from "next/link";
import { redirect } from "next/navigation";
import { Baby, BookOpen, Calendar, ChevronRight, Gauge, Home, Music2, Settings, Sparkles, User, Users, Wrench } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { getActiveMinistry } from "@/lib/ministry";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { buildShellNavigation, type ShellNavItemId } from "@/lib/shell-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteLink } from "@/components/invite-link";
import { PushToggle } from "@/components/push/push-toggle";

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
  assistente: Sparkles,
  perfil: User,
  pessoas: Users,
  distribuicao: Gauge,
  equipamentos: Wrench,
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
  const visibleNav = nav.filter(
    (item) => !(["louvor", "kids", "assistente"] as ShellNavItemId[]).includes(item.id)
  );
  const vapidPublicKey = serverEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY");

  const supabase = await createClient();
  const { data: inviteCode } = tenant.role === "admin"
    ? await supabase.rpc("get_church_invite_code", { p_church: tenant.church.id })
    : { data: null };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Mais
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Mais opções</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Acesse configurações, perfil e recursos complementares do LUNOR.
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Notificações no celular</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ative os avisos do LUNOR neste aparelho para receber informações importantes.
          </p>
        </div>
        <PushToggle
          churchId={tenant.church.id}
          vapidPublicKey={vapidPublicKey}
        />
      </section>

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
        {visibleNav.map((item) => {
          const Icon = ICONS[item.id];
          const description = item.id === "pessoas"
            ? "Pessoas, funções e permissões da equipe"
            : item.id === "admin"
              ? "Configurações, campi, convite e gestão da igreja"
              : item.id === "perfil"
                ? "Perfil e seus dados"
                : item.id === "escalas"
                  ? "Cultos, convites e suas próximas escalas"
                  : item.id === "ministry"
                    ? "Disponibilidade e visão do ministério ativo"
                    : item.id === "distribuicao"
                      ? "Radar de carga: quem está sobrecarregado ou esquecido nas escalas"
                      : item.id === "equipamentos"
                        ? "Inventário, patrimônio e chamados de manutenção"
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

      <Link href={`/${churchSlug}/guia`} className="block">
        <Card className="rounded-3xl transition-colors hover:bg-accent/40">
          <CardContent className="flex items-center gap-4 py-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
              <BookOpen className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Central de ajuda</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Entenda os papéis e o que cada um pode fazer no LUNOR
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
