import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  Calendar,
  CalendarDays,
  ChevronRight,
  Gauge,
  Home,
  Settings,
  Sparkles,
  User,
  Users,
  UsersRound,
  Wrench,
} from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { getActiveMinistry } from "@/lib/ministry";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  buildShellNavigation,
  type ShellNavItemId,
} from "@/lib/shell-navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InviteLink } from "@/components/invite-link";
import { PushToggle } from "@/components/push/push-toggle";

const ICONS: Record<
  ShellNavItemId,
  React.ComponentType<{ className?: string }>
> = {
  home: Home,
  agenda: CalendarDays,
  times: UsersRound,
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
  const hasLouvor = options.some((ministry) => ministry.module_key === "worship");
  const hasKids = tenant.isGuardian || options.some((ministry) => ministry.module_key === "kids");
  const activeMinistryNavigation = active?.module_key === "generic"
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
    (item) =>
      !(["home", "agenda", "times", "escalas", "assistente"] as ShellNavItemId[]).includes(item.id)
  );
  const vapidPublicKey = serverEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY");

  const supabase = await createClient();
  const { data: inviteCode } = tenant.role === "admin"
    ? await supabase.rpc("get_church_invite_code", { p_church: tenant.church.id })
    : { data: null };

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>Mais opções</>}
        eyebrow={<>Mais</>}
        description={
          <>Acesse configurações, perfil e recursos complementares do LUNOR.</>
        }
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Notificações no celular</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ative os avisos do LUNOR neste aparelho para receber informações
            importantes.
          </p>
        </div>
        <PushToggle
          churchId={tenant.church.id}
          vapidPublicKey={vapidPublicKey}
        />
      </section>

      <Link href={`/${churchSlug}/versiculo-do-dia`} className="block">
        <Card className="transition-colors hover:bg-accent/40">
          <CardContent className="flex items-center gap-4 py-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
              <BookOpen className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Versículo do dia</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Leia o versículo de hoje e compartilhe com alguém
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      {tenant.role === "admin" && inviteCode && (
        <Card className="border-brand/35 bg-brand/8">
          <CardHeader>
            <CardTitle className="text-base">Convidar pessoa</CardTitle>
            <CardDescription>
              Compartilhe o convite da igreja para novos voluntários e
              integrantes da equipe.
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
          const description =
            item.id === "pessoas"
              ? "Pessoas, funções e permissões da equipe"
              : item.id === "admin"
                ? "Configurações, campi, convite e gestão da igreja"
                : item.id === "perfil"
                  ? "Perfil e seus dados"
                  : item.id === "escalas"
                    ? "Cultos, convites e suas próximas escalas"
                    : item.id === "distribuicao"
                        ? "Radar de carga: quem está sobrecarregado ou esquecido nas escalas"
                        : item.id === "equipamentos"
                          ? "Inventário, patrimônio e chamados de manutenção"
                          : `Abrir ${item.label}`;

          return (
            <Link
              key={`${item.id}-${item.href}`}
              href={`/${churchSlug}${item.href}`}
              className="block"
            >
              <Card className="h-full transition-colors hover:bg-accent/40">
                <CardContent className="flex items-center gap-4 py-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.label}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {description}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Link href={`/${churchSlug}/guia`} className="block">
        <Card className="transition-colors hover:bg-accent/40">
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
