import Link from "next/link";
import { redirect } from "next/navigation";
import { Baby, Calendar, ChevronRight, Home, Music2, Send, Settings, User, Users } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { getActiveMinistry } from "@/lib/ministry";
import { buildShellNavigation, type ShellNavItemId } from "@/lib/shell-navigation";
import { Card, CardContent } from "@/components/ui/card";

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

      {tenant.role === "admin" && (
        <Link href={`/${churchSlug}/admin#convite`} className="block">
          <Card className="rounded-3xl border-[#6e5ce6]/35 bg-[#6e5ce6]/8 transition-colors hover:bg-[#6e5ce6]/12">
            <CardContent className="flex items-center gap-4 py-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#6e5ce6] text-white">
                <Send className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Convidar pessoa</p>
                <p className="text-sm text-muted-foreground">Compartilhar o convite da igreja</p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
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
