import { createClient } from "@/lib/supabase/server";
import {
  buildDistributionOverview,
  type DistributionAssignment,
  type DistributionMember,
  type DistributionOverview,
} from "@/lib/distribution";

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 90;
const UPCOMING_DAYS = 45;

type EventRelation =
  | { id: string; title: string; starts_at: string }
  | { id: string; title: string; starts_at: string }[]
  | null;

type ProfileRelation = { full_name: string } | { full_name: string }[] | null;

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

/**
 * Carrega o radar de distribuição.
 *
 * Quando `ministryId` é informado, o roster vem de `ministry_members` e as
 * escalas são filtradas pelo mesmo setor — é a visão do líder sobre o time
 * que ele realmente conduz. Sem `ministryId`, cai para a igreja inteira
 * (usado pela página /distribuicao por coordenadores).
 */
export async function loadDistributionOverview({
  churchId,
  ministryId,
  now = new Date(),
  weeksBack = 8,
}: {
  churchId: string;
  ministryId?: string | null;
  now?: Date;
  weeksBack?: number;
}): Promise<DistributionOverview> {
  const supabase = await createClient();
  const historyFrom = new Date(now.getTime() - HISTORY_DAYS * DAY_MS).toISOString();
  const upcomingTo = new Date(now.getTime() + UPCOMING_DAYS * DAY_MS).toISOString();

  const rosterQuery = ministryId
    ? supabase
        .from("ministry_members")
        .select("user_id, profiles!inner(full_name)")
        .eq("church_id", churchId)
        .eq("ministry_id", ministryId)
        .eq("active", true)
    : supabase
        .from("church_members")
        .select("user_id, profiles!inner(full_name)")
        .eq("church_id", churchId)
        .eq("status", "active");

  let assignmentsQuery = supabase
    .from("assignments")
    .select("user_id, status, events!inner(id, title, starts_at)")
    .eq("church_id", churchId)
    .gte("events.starts_at", historyFrom)
    .lte("events.starts_at", upcomingTo);

  if (ministryId) {
    assignmentsQuery = assignmentsQuery.eq("ministry_id", ministryId);
  }

  const [{ data: roster }, { data: assignments }] = await Promise.all([
    rosterQuery,
    assignmentsQuery,
  ]);

  const members: DistributionMember[] = (roster ?? []).map((row) => {
    const profile = firstRelated((row as { profiles: ProfileRelation }).profiles);
    return {
      userId: (row as { user_id: string }).user_id,
      name: profile?.full_name ?? "",
    };
  });

  const normalized: DistributionAssignment[] = [];
  for (const row of assignments ?? []) {
    const typed = row as { user_id: string; status: string; events: EventRelation };
    const event = firstRelated(typed.events);
    if (!event) continue;
    normalized.push({
      userId: typed.user_id,
      status: typed.status,
      eventId: event.id,
      eventTitle: event.title,
      startsAt: event.starts_at,
    });
  }

  return buildDistributionOverview({
    members,
    assignments: normalized,
    now,
    weeksBack,
  });
}
