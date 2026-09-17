import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Baby, CalendarCheck, Music2, UsersRound } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { getActiveMinistry, type MinistryOption } from "@/lib/ministry";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

function teamDestination(churchSlug: string, team: MinistryOption) {
  if (team.module_key === "worship") return `/${churchSlug}/louvor`;
  if (team.module_key === "kids") return `/${churchSlug}/infantil`;
  return `/${churchSlug}/disponibilidade?ministry=${team.id}`;
}

function teamIcon(team: MinistryOption) {
  if (team.module_key === "worship") return Music2;
  if (team.module_key === "kids") return Baby;
  return UsersRound;
}

function teamDescription(team: MinistryOption) {
  if (team.module_key === "worship") {
    return "Músicas, repertórios, disponibilidade e preparo do Louvor.";
  }
  if (team.module_key === "kids") {
    return "Escalas, disponibilidade e operação especializada do Kids.";
  }
  return "Disponibilidade, eventos e escalas deste time.";
}

export default async function TimesPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  if (tenant.guardianOnly) redirect(`/${churchSlug}/infantil`);

  const { options } = await getActiveMinistry(churchSlug);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<>Times</>}
        title={<>Seus times</>}
        description={
          <>Acesse somente as áreas da igreja em que você participa ou possui permissão.</>
        }
      />

      {options.length === 0 ? (
        <EmptyState
          title="Nenhum time disponível"
          description="Quando você for adicionado a um time, o acesso aparecerá aqui."
        />
      ) : (
        <section
          aria-label="Times acessíveis"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {options.map((team) => {
            const Icon = teamIcon(team);
            const destination = teamDestination(churchSlug, team);
            return (
              <Card key={team.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    {team.canManage && <Badge variant="secondary">Gestão</Badge>}
                  </div>
                  <CardTitle className="pt-3 text-lg">{team.name}</CardTitle>
                  <CardDescription>{teamDescription(team)}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 border-t pt-4">
                  <Link
                    href={destination}
                    className="inline-flex min-h-11 items-center justify-between gap-3 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
                  >
                    Abrir {team.name}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href={`/${churchSlug}/escalas?filtro=minhas`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <CalendarCheck className="size-4" aria-hidden="true" />
                    Ver minhas escalas
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
