import { PageHeader } from "@/components/ui/page-header";
import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import {
  getInfantilMinistry,
  formatAge,
  suggestClass,
  type ChildClass,
} from "@/lib/infantil";
import { eventContextLabel } from "@/lib/event-context";
import { kidsPrintSettingsFromRow } from "@/lib/kids-print-settings";
import { Card, CardContent } from "@/components/ui/card";
import type {
  Guardian,
  SessionChild,
} from "@/components/infantil/session-child";
import { ReceptionSearch } from "@/components/infantil/reception-search";
import {
  KidsDeliveryOverview,
  type KidsDeliveryItem,
} from "@/components/infantil/kids-delivery-overview";

type DeliveryStatusRow = {
  page_id: string;
  checkin_id: string | null;
  kind: "chamar" | "fim_sessao";
  recipient_count: number | string;
  acknowledged_count: number | string;
  last_acknowledged_at: string | null;
  created_at: string;
  resolved_at: string | null;
};

type ReceptionRow = {
  session_id: string;
  title: string;
  event_id: string | null;
  campus_id: string | null;
  campus_name: string | null;
  opened_at: string;
};

export default async function KidsReceptionPage({
  params,
}: {
  params: Promise<{ churchSlug: string; sessionId: string }>;
}) {
  const { churchSlug, sessionId } = await params;
  const tenant = await getTenant(churchSlug);
  const ministry = await getInfantilMinistry(tenant.church.id);
  if (!ministry || tenant.guardianOnly) redirect(`/${churchSlug}/infantil`);

  const supabase = await createClient();
  const [{ data: canOperate }, { data: receptionRows }] = await Promise.all([
    supabase.rpc("can_operate_kids_reception", {
      p_church: tenant.church.id,
      p_ministry: ministry.id,
      p_session: sessionId,
    }),
    supabase.rpc("current_kids_reception", {
      p_church: tenant.church.id,
      p_ministry: ministry.id,
    }),
  ]);

  const reception = ((receptionRows ?? []) as ReceptionRow[]).find(
    (row) => row.session_id === sessionId
  );
  if (!canOperate || !reception) redirect(`/${churchSlug}/infantil`);

  const { data: membership } = await supabase
    .from("ministry_members")
    .select("role")
    .eq("church_id", tenant.church.id)
    .eq("ministry_id", ministry.id)
    .eq("user_id", tenant.userId)
    .eq("active", true)
    .maybeSingle();

  const podeLiberar =
    tenant.isCoord || membership?.role === "gerente" || membership?.role === "lider";

  let classQuery = supabase
    .from("child_classes")
    .select("id, name, min_age_months, max_age_months")
    .eq("ministry_id", ministry.id)
    .order("sort_order");
  classQuery = reception.campus_id
    ? classQuery.eq("campus_id", reception.campus_id)
    : classQuery.is("campus_id", null);

  const [
    { data: classes },
    { data: children },
    { data: checkins },
    { data: deliveryRows },
    { data: printSettingsRow },
    { data: event },
  ] = await Promise.all([
    classQuery,
    supabase
      .from("children")
      .select("id, full_name, birth_date, allergies, special_needs")
      .eq("ministry_id", ministry.id)
      .eq("active", true)
      .order("full_name"),
    supabase
      .from("child_checkins")
      .select("id, child_id, class_id, code, pickup_qr_token, checked_out_at, checked_in_at")
      .eq("reception_session_id", sessionId)
      .order("checked_in_at", { ascending: true }),
    supabase.rpc("child_page_delivery_status_session", { p_session: sessionId }),
    supabase
      .from("kids_print_settings")
      .select(
        "print_mode, label_width_mm, label_height_mm, margin_mm, orientation, copies, qr_enabled"
      )
      .eq("ministry_id", ministry.id)
      .maybeSingle(),
    reception.event_id
      ? supabase
          .from("events")
          .select("id, title, location, service_period, campuses(name)")
          .eq("id", reception.event_id)
          .eq("church_id", tenant.church.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const printSettings = kidsPrintSettingsFromRow(printSettingsRow);
  const campus = event?.campuses as unknown as { name: string } | null | undefined;
  const receptionContext = event
    ? eventContextLabel({
        campusName: campus?.name,
        servicePeriod: event.service_period,
        fallbackLocation: event.location,
      })
    : reception.campus_name
      ? `Campus ${reception.campus_name}`
      : "Campus não definido";

  const childIds = (children ?? []).map((child) => child.id);
  const { data: links } = childIds.length
    ? await supabase
        .from("child_guardians")
        .select("child_id, can_pickup, relationship, guardians!inner(id, full_name, phone)")
        .in("child_id", childIds)
    : { data: [] };

  const guardiansByChild = new Map<string, Guardian[]>();
  for (const link of links ?? []) {
    const guardian = link.guardians as unknown as {
      id: string;
      full_name: string;
      phone: string | null;
    };
    guardiansByChild.set(link.child_id, [
      ...(guardiansByChild.get(link.child_id) ?? []),
      {
        id: guardian.id,
        name: guardian.full_name,
        phone: guardian.phone,
        canPickup: link.can_pickup,
        relationship: link.relationship,
      },
    ]);
  }

  const latestByChild = new Map<
    string,
    {
      id: string;
      code: string;
      pickupToken: string;
      checkedOut: boolean;
      classId: string | null;
    }
  >();
  for (const row of checkins ?? []) {
    latestByChild.set(row.child_id, {
      id: row.id,
      code: row.code,
      pickupToken: row.pickup_qr_token,
      checkedOut: !!row.checked_out_at,
      classId: row.class_id,
    });
  }

  const turmas = (classes ?? []) as ChildClass[];
  const classOptions = turmas.map((item) => ({ id: item.id, name: item.name }));
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
      checkin: latestByChild.get(child.id) ?? null,
      guardians: guardiansByChild.get(child.id) ?? [],
    };
  });

  const codeByCheckin = new Map((checkins ?? []).map((row) => [row.id, row.code]));
  const deliveryItems: KidsDeliveryItem[] = [];
  const seenDelivery = new Set<string>();
  for (const row of (deliveryRows ?? []) as DeliveryStatusRow[]) {
    const key = row.kind === "fim_sessao" ? "fim_sessao" : `chamar:${row.checkin_id ?? row.page_id}`;
    if (seenDelivery.has(key)) continue;
    seenDelivery.add(key);
    deliveryItems.push({
      pageId: row.page_id,
      kind: row.kind,
      code: row.checkin_id ? codeByCheckin.get(row.checkin_id) ?? null : null,
      status: {
        recipientCount: Number(row.recipient_count),
        acknowledgedCount: Number(row.acknowledged_count),
        lastAcknowledgedAt: row.last_acknowledged_at,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
      },
    });
  }

  const presentes = (checkins ?? []).filter((row) => !row.checked_out_at).length;
  const entradas = checkins?.length ?? 0;
  const saidas = (checkins ?? []).filter((row) => !!row.checked_out_at).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{reception.title}</>}
        eyebrow={
          <>
            Kids · Recepção aberta
            {reception.campus_name ? ` · ${reception.campus_name}` : ""}
          </>
        }
        description={
          <>
            {event
              ? `Contexto: ${event.title}${receptionContext ? ` · ${receptionContext}` : ""}`
              : `Recepção independente · ${receptionContext}`}
          </>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="px-4 py-5">
            <p className="text-2xl font-semibold">{presentes}</p>
            <p className="text-xs text-muted-foreground">Presentes agora</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 py-5">
            <p className="text-2xl font-semibold">{entradas}</p>
            <p className="text-xs text-muted-foreground">Check-ins</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 py-5">
            <p className="text-2xl font-semibold">{saidas}</p>
            <p className="text-xs text-muted-foreground">Check-outs</p>
          </CardContent>
        </Card>
      </div>

      {presentes > 0 && (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          Ainda há {presentes}{" "}
          {presentes === 1 ? "criança presente" : "crianças presentes"}. A
          recepção só poderá ser encerrada após as retiradas.
        </p>
      )}

      {turmas.length === 0 && (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          Nenhuma turma está configurada para{" "}
          {reception.campus_name ?? "este campus"}. Configure as faixas em Kids
          → Configurações antes de fazer check-in.
        </p>
      )}

      <KidsDeliveryOverview items={deliveryItems} />

      {sessionChildren.length > 0 ? (
        <ReceptionSearch
          sessionChildren={sessionChildren}
          classOptions={classOptions}
          churchName={tenant.church.name}
          churchSlug={churchSlug}
          churchId={tenant.church.id}
          ministryId={ministry.id}
          sessionId={sessionId}
          eventId={reception.event_id}
          eventTitle={reception.title}
          eventContext={receptionContext}
          podeLiberar={podeLiberar}
          printSettings={printSettings}
        />
      ) : (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Nenhuma criança cadastrada. Cadastre na tela do Kids.
            </p>
          </CardContent>
        </Card>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        A criança só sai com responsável autorizado. Exceções exigem
        justificativa e ficam registradas.
      </p>
    </div>
  );
}
