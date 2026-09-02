import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { buildIcs } from "@/lib/ics";
import { resolveServiceWindow } from "@/lib/service-window";

const TWO_HOURS = 2 * 60 * 60 * 1000;

type AssignmentWindowRow = {
  ministry_id: string;
  arrival_time: string | null;
  release_time: string | null;
};

type TeamWindowRow = {
  ministry_id: string;
  arrival_at: string | null;
  release_at: string | null;
};

/**
 * Gera o .ics usando a obrigação real do voluntário quando ele está escalado.
 * Precedência: override individual -> horário do ministério -> horário do culto.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ churchSlug: string; id: string }> }
) {
  const { churchSlug, id } = await params;
  const tenant = await getTenant(churchSlug);

  const supabase = await createClient();
  const [{ data: event }, { data: assignments }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, location, description, script, starts_at, ends_at")
      .eq("id", id)
      .eq("church_id", tenant.church.id)
      .maybeSingle(),
    supabase
      .from("assignments")
      .select("ministry_id, arrival_time, release_time")
      .eq("church_id", tenant.church.id)
      .eq("event_id", id)
      .eq("user_id", tenant.userId)
      .neq("status", "substituido"),
  ]);

  if (!event) {
    return new Response("Evento não encontrado", { status: 404 });
  }

  const assignmentRows = (assignments ?? []) as unknown as AssignmentWindowRow[];
  const ministryIds = [...new Set(assignmentRows.map((item) => item.ministry_id))];
  const { data: teamWindows } = ministryIds.length
    ? await supabase
        .from("event_ministry_windows")
        .select("ministry_id, arrival_at, release_at")
        .eq("church_id", tenant.church.id)
        .eq("event_id", id)
        .in("ministry_id", ministryIds)
    : { data: [] as TeamWindowRow[] };
  const windowByMinistry = new Map(
    ((teamWindows ?? []) as unknown as TeamWindowRow[]).map((item) => [item.ministry_id, item])
  );

  const effective = assignmentRows.map((assignment) => {
    const window = windowByMinistry.get(assignment.ministry_id);
    return resolveServiceWindow({
      eventStart: event.starts_at,
      eventEnd: event.ends_at,
      teamArrival: window?.arrival_at,
      teamRelease: window?.release_at,
      assignmentArrival: assignment.arrival_time,
      assignmentRelease: assignment.release_time,
    });
  });

  const eventStart = new Date(event.starts_at);
  const defaultEnd = event.ends_at
    ? new Date(event.ends_at)
    : new Date(eventStart.getTime() + TWO_HOURS);
  const start = effective.length > 0
    ? new Date(Math.min(...effective.map((item) => new Date(item.arrivalAt).getTime())))
    : eventStart;
  const releases = effective
    .map((item) => item.releaseAt)
    .filter((value): value is string => Boolean(value));
  const end = releases.length > 0
    ? new Date(Math.max(...releases.map((value) => new Date(value).getTime())))
    : defaultEnd;

  const ics = buildIcs({
    uid: `${event.id}@lunor`,
    title: assignmentRows.length > 0 ? `${event.title} · Minha escala` : event.title,
    start,
    end,
    location: event.location,
    description: event.description || event.script || null,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="escala.ics"',
    },
  });
}
