import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getInfantilMinistry, formatAge, suggestClass, type ChildClass } from "@/lib/infantil";
import { formatEventDate, formatEventTime } from "@/lib/escalas";
import { eventContextLabel } from "@/lib/event-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Guardian, SessionChild } from "@/components/infantil/session-child";
import { ReceptionSearch } from "@/components/infantil/reception-search";
import { EndSessionButton } from "@/components/infantil/end-session-button";

export default async function SessaoInfantilPage({
  params,
}: {
  params: Promise<{ churchSlug: string; eventId: string }>;
}) {
  const { churchSlug, eventId } = await params;
  const tenant = await getTenant(churchSlug);
  const ministry = await getInfantilMinistry(tenant.church.id);
  if (!ministry) redirect(`/${churchSlug}/infantil`);

  const supabase = await createClient();
  const { data: vinculo } = await supabase
    .from("ministry_members")
    .select("role")
    .eq("ministry_id", ministry.id)
    .eq("user_id", tenant.userId)
    .eq("active", true)
    .maybeSingle();
  if (!vinculo && !tenant.isCoord) redirect(`/${churchSlug}`);
  const podeLiberar =
    tenant.isCoord || vinculo?.role === "gerente" || vinculo?.role === "lider";

  const [{ data: event }, { data: classes }, { data: children }, { data: checkins }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, title, starts_at, location, service_period, campuses(name)")
        .eq("id", eventId)
        .eq("church_id", tenant.church.id)
        .maybeSingle(),
      supabase
        .from("child_classes")
        .select("id, name, min_age_months, max_age_months")
        .eq("ministry_id", ministry.id)
        .order("sort_order"),
      supabase
        .from("children")
        .select("id, full_name, birth_date, allergies, special_needs")
        .eq("ministry_id", ministry.id)
        .eq("active", true)
        .order("full_name"),
      supabase
        .from("child_checkins")
        .select("id, child_id, code, checked_out_at")
        .eq("event_id", eventId),
    ]);

  if (!event) notFound();

  const campus = event.campuses as unknown as { name: string } | null;
  const eventContext = eventContextLabel({
    campusName: campus?.name,
    servicePeriod: event.service_period,
    fallbackLocation: event.location,
  });

  const childIds = (children ?? []).map((child) => child.id);
  const { data: vinculos } = childIds.length
    ? await supabase
        .from("child_guardians")
        .select("child_id, can_pickup, relationship, guardians!inner(id, full_name, phone)")
        .in("child_id", childIds)
    : { data: [] };

  const guardiansByChild = new Map<string, Guardian[]>();
  for (const v of vinculos ?? []) {
    const g = v.guardians as unknown as {
      id: string;
      full_name: string;
      phone: string | null;
    };
    guardiansByChild.set(v.child_id, [
      ...(guardiansByChild.get(v.child_id) ?? []),
      {
        id: g.id,
        name: g.full_name,
        phone: g.phone,
        canPickup: v.can_pickup,
        relationship: v.relationship,
      },
    ]);
  }

  const checkinByChild = new Map(
    (checkins ?? []).map((k) => [
      k.child_id,
      { id: k.id, code: k.code, checkedOut: !!k.checked_out_at },
    ])
  );

  const turmas = (classes ?? []) as ChildClass[];
  const sessionChildren: SessionChild[] = (children ?? []).map((child) => {
    const turma = suggestClass(child.birth_date, turmas);
    return {
      id: child.id,
      fullName: child.full_name,
      age: formatAge(child.birth_date),
      allergies: child.allergies,
      specialNeeds: child.special_needs,
      classId: turma?.id ?? null,
      className: turma?.name ?? null,
      checkin: checkinByChild.get(child.id) ?? null,
      guardians: guardiansByChild.get(child.id) ?? [],
    };
  });

  const presentes = (checkins ?? []).filter((k) => !k.checked_out_at).length;
  const entradas = checkins?.length ?? 0;
  const saidas = (checkins ?? []).filter((k) => !!k.checked_out_at).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          nativeButton={false}
          variant="outline"
          className="h-10 rounded-full px-4"
          render={<Link href={`/${churchSlug}/infantil`} />}
        >
          <LayoutDashboard className="size-4" />
          LUNOR Kids
        </Button>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Kids · Recepção · {formatEventDate(event.starts_at)} · {formatEventTime(event.starts_at)}
          {eventContext ? ` · ${eventContext}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{event.title}</h1>
        <p className="text-muted-foreground">
          Busque a família e faça entrada, retirada ou chamada em poucos toques.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-3xl">
          <CardContent className="px-4 py-5">
            <p className="text-2xl font-semibold">{presentes}</p>
            <p className="text-xs text-muted-foreground">Presentes agora</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardContent className="px-4 py-5">
            <p className="text-2xl font-semibold">{entradas}</p>
            <p className="text-xs text-muted-foreground">Check-ins</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardContent className="px-4 py-5">
            <p className="text-2xl font-semibold">{saidas}</p>
            <p className="text-xs text-muted-foreground">Check-outs</p>
          </CardContent>
        </Card>
      </div>

      <EndSessionButton
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        ministryId={ministry.id}
        eventId={eventId}
        presentes={presentes}
      />

      {sessionChildren.length > 0 ? (
        <ReceptionSearch
          sessionChildren={sessionChildren}
          churchSlug={churchSlug}
          churchId={tenant.church.id}
          ministryId={ministry.id}
          eventId={eventId}
          eventTitle={event.title}
          eventContext={eventContext}
          podeLiberar={podeLiberar}
        />
      ) : (
        <Card className="rounded-3xl">
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Nenhuma criança cadastrada. Cadastre na tela do Kids.
            </p>
          </CardContent>
        </Card>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        A criança só sai com responsável autorizado. Exceções exigem justificativa
        e ficam registradas.
      </p>
    </div>
  );
}
