import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";
import { createClient } from "@/lib/supabase/server";
import type { AvailabilityPeriod, AvailabilityStatus } from "@/lib/actions/availability";
import {
  AvailabilityCalendar,
  type CalendarAvailabilityEntry,
  type RecurringAvailabilityEntry,
} from "@/components/disponibilidade/availability-calendar";

export default async function KidsAvailabilityPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const kids = await getInfantilMinistry(tenant.church.id);
  if (!kids) redirect(`/${churchSlug}/infantil`);

  const supabase = await createClient();
  if (!tenant.isCoord) {
    const { data: membership } = await supabase
      .from("ministry_members")
      .select("id")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", kids.id)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle();
    if (!membership) redirect(`/${churchSlug}`);
  }

  const now = new Date();
  const initialMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const [
    { data: calendarAvailability },
    { data: recurringAvailability },
    { data: campuses },
  ] = await Promise.all([
    supabase
      .from("member_availability_calendar")
      .select("availability_date, period, status, campus_id")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", kids.id)
      .eq("user_id", tenant.userId)
      .gte("availability_date", initialMonth)
      .order("availability_date")
      .limit(500),
    supabase
      .from("member_availability_recurring")
      .select("weekday, period, status, campus_id")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", kids.id)
      .eq("user_id", tenant.userId)
      .order("weekday"),
    supabase
      .from("campuses")
      .select("id, name")
      .eq("church_id", tenant.church.id)
      .eq("active", true)
      .order("sort_order")
      .order("name"),
  ]);

  const calendarEntries: CalendarAvailabilityEntry[] = (calendarAvailability ?? []).map((row) => ({
    date: row.availability_date,
    period: row.period as AvailabilityPeriod,
    status: row.status as AvailabilityStatus,
    campusId: row.campus_id,
  }));
  const recurringEntries: RecurringAvailabilityEntry[] = (recurringAvailability ?? []).map((row) => ({
    weekday: row.weekday,
    period: row.period as AvailabilityPeriod,
    status: row.status as AvailabilityStatus,
    campusId: row.campus_id,
  }));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">LUNOR Kids</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Disponibilidade</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Informe quando você pode servir no Kids, mesmo antes de existir um culto ou uma escala.
        </p>
      </header>

      <AvailabilityCalendar
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        ministryId={kids.id}
        scopeLabel="Kids"
        initialMonth={initialMonth}
        entries={calendarEntries}
        recurring={recurringEntries}
        campuses={campuses ?? []}
      />
    </div>
  );
}
