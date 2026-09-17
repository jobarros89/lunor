import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";
import { createClient } from "@/lib/supabase/server";
import { formatEventDate, formatEventTime } from "@/lib/escalas";
import { eventContextLabel } from "@/lib/event-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  QrPickupConfirm,
  type PickupGuardian,
} from "@/components/infantil/qr-pickup-confirm";

export default async function KidsQrPickupPage({
  params,
}: {
  params: Promise<{ churchSlug: string; token: string }>;
}) {
  const { churchSlug, token } = await params;
  const tenant = await getTenant(churchSlug);
  const kids = await getInfantilMinistry(tenant.church.id);
  if (!kids) redirect(`/${churchSlug}`);

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("ministry_members")
    .select("role")
    .eq("church_id", tenant.church.id)
    .eq("ministry_id", kids.id)
    .eq("user_id", tenant.userId)
    .eq("active", true)
    .maybeSingle();

  if (!membership && !tenant.isCoord) redirect(`/${churchSlug}`);
  const canOverride =
    tenant.isCoord || membership?.role === "gerente" || membership?.role === "lider";

  const { data: checkin } = await supabase
    .from("child_checkins")
    .select(
      "id, event_id, child_id, code, checked_in_at, checked_out_at, children!inner(full_name), child_classes(name), events!inner(title, starts_at, location, service_period, campuses(name))"
    )
    .eq("church_id", tenant.church.id)
    .eq("ministry_id", kids.id)
    .eq("pickup_qr_token", token)
    .maybeSingle();

  if (!checkin) notFound();

  const child = checkin.children as unknown as { full_name: string };
  const childClass = checkin.child_classes as unknown as { name: string } | null;
  const event = checkin.events as unknown as {
    title: string;
    starts_at: string;
    location: string | null;
    service_period: string | null;
    campuses: { name: string } | null;
  };
  const context = eventContextLabel({
    campusName: event.campuses?.name,
    servicePeriod: event.service_period,
    fallbackLocation: event.location,
  });

  const { data: guardianRows } = await supabase
    .from("child_guardians")
    .select("can_pickup, relationship, guardians!inner(id, full_name)")
    .eq("child_id", checkin.child_id);

  const guardians: PickupGuardian[] = (guardianRows ?? []).map((row) => {
    const guardian = row.guardians as unknown as { id: string; full_name: string };
    return {
      id: guardian.id,
      name: guardian.full_name,
      relationship: row.relationship,
      canPickup: row.can_pickup,
    };
  });

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          LUNOR Kids · Retirada por QR
        </p>
        <h1 className="page-title mt-1">{child.full_name}</h1>
        <p className="text-sm text-muted-foreground">
          {event.title} · {formatEventDate(event.starts_at)} · {formatEventTime(event.starts_at)}
          {context ? ` · ${context}` : ""}
        </p>
      </header>

      <Card className="rounded-3xl">
        <CardContent className="space-y-5 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Código da sessão</p>
              <p className="text-3xl font-bold tracking-[0.18em]">{checkin.code}</p>
            </div>
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {childClass?.name ?? "Turma não definida"}
            </Badge>
          </div>

          {checkin.checked_out_at ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
              <ShieldCheck className="mx-auto size-7 text-emerald-700 dark:text-emerald-400" />
              <p className="mt-2 font-medium">Retirada já concluída</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Este QR não pode iniciar uma nova retirada. Para uma nova entrada, faça outro check-in da criança.
              </p>
            </div>
          ) : (
            <QrPickupConfirm
              churchSlug={churchSlug}
              eventId={checkin.event_id}
              checkinId={checkin.id}
              guardians={guardians}
              canOverride={canOverride}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
