import { createClient } from "@/lib/supabase/server";

export type KidsContext = {
  churchId: string;
  ministryId: string;
  ministryName: string;
};

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
};

type RelatedEvent =
  | { id: string; title: string; starts_at: string }
  | { id: string; title: string; starts_at: string }[]
  | null;

const DEFAULT_EVENT_DURATION_MS = 4 * 60 * 60 * 1000;

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function isKidsMinistryName(name: string) {
  const normalized = normalize(name);
  return (
    normalized.includes("kids") ||
    normalized.includes("infantil") ||
    normalized.includes("crianca")
  );
}

function assertKidsScope(context: KidsContext) {
  if (!isKidsMinistryName(context.ministryName)) {
    throw new Error("kids_scope_required");
  }
}

function eventEndMs(event: EventRow) {
  const startsAt = new Date(event.starts_at).getTime();
  if (event.ends_at) return new Date(event.ends_at).getTime();
  return startsAt + DEFAULT_EVENT_DURATION_MS;
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export async function getKidsOperationalInsights(
  context: KidsContext,
  input: { eventId?: string; historyDays?: number } = {}
) {
  assertKidsScope(context);
  const supabase = await createClient();
  const historyDays = Math.min(Math.max(input.historyDays ?? 90, 14), 365);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  let selectedEvent: EventRow | null = null;

  if (input.eventId) {
    const { data, error } = await supabase
      .from("events")
      .select("id, title, starts_at, ends_at")
      .eq("church_id", context.churchId)
      .eq("id", input.eventId)
      .maybeSingle();
    if (error || !data) throw new Error("event_not_found");
    selectedEvent = data;
  } else {
    const windowStart = new Date(nowMs - 6 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("events")
      .select("id, title, starts_at, ends_at")
      .eq("church_id", context.churchId)
      .gte("starts_at", windowStart)
      .order("starts_at")
      .limit(8);
    if (error) throw new Error("kids_events_unavailable");
    selectedEvent =
      ((data ?? []) as EventRow[]).find((event) => eventEndMs(event) >= nowMs) ?? null;
  }

  const [
    { data: classes, error: classesError },
    { data: children, error: childrenError },
    { data: guardians, error: guardiansError },
  ] = await Promise.all([
    supabase
      .from("child_classes")
      .select("id, name")
      .eq("church_id", context.churchId)
      .eq("ministry_id", context.ministryId)
      .order("sort_order"),
    supabase
      .from("children")
      .select(
        "id, allergies, special_needs, emergency_contact_name, emergency_contact_phone"
      )
      .eq("church_id", context.churchId)
      .eq("ministry_id", context.ministryId)
      .eq("active", true),
    supabase
      .from("guardians")
      .select("id, user_id")
      .eq("church_id", context.churchId)
      .eq("ministry_id", context.ministryId),
  ]);

  if (classesError) throw new Error("kids_classes_unavailable");
  if (childrenError) throw new Error("kids_children_unavailable");
  if (guardiansError) throw new Error("kids_guardians_unavailable");

  const childRows = children ?? [];
  const childIds = childRows.map((child) => child.id);
  let authorizedPickupChildIds = new Set<string>();

  if (childIds.length > 0) {
    const { data: pickupRows, error: pickupError } = await supabase
      .from("child_guardians")
      .select("child_id, can_pickup")
      .in("child_id", childIds)
      .eq("can_pickup", true);
    if (pickupError) throw new Error("kids_pickup_authorization_unavailable");
    authorizedPickupChildIds = new Set(
      (pickupRows ?? []).map((row) => row.child_id)
    );
  }

  const registration = {
    activeChildren: childRows.length,
    classes: (classes ?? []).length,
    guardians: (guardians ?? []).length,
    guardiansWithLunorAccount: (guardians ?? []).filter((guardian) => guardian.user_id)
      .length,
    careSignals: {
      childrenWithAllergyFlag: childRows.filter((child) => Boolean(child.allergies?.trim()))
        .length,
      childrenWithSpecialNeedsFlag: childRows.filter((child) =>
        Boolean(child.special_needs?.trim())
      ).length,
    },
    missingEmergencyContact: childRows.filter(
      (child) =>
        !child.emergency_contact_name?.trim() || !child.emergency_contact_phone?.trim()
    ).length,
    withoutAuthorizedPickup: childRows.filter(
      (child) => !authorizedPickupChildIds.has(child.id)
    ).length,
  };

  let session: null | {
    event: {
      id: string;
      title: string;
      startsAt: string;
      endsAt: string | null;
      ended: boolean;
    };
    checkedIn: number;
    present: number;
    checkedOut: number;
    presentWithoutClass: number;
    unresolvedCalls: number;
    oldestUnresolvedCallMinutes: number | null;
    pickupOverrides: number;
    presentCareSignals: {
      allergyFlags: number;
      specialNeedsFlags: number;
    };
    classes: Array<{ name: string; present: number }>;
  } = null;

  if (selectedEvent) {
    const [
      { data: checkins, error: checkinsError },
      { data: pages, error: pagesError },
    ] = await Promise.all([
      supabase
        .from("child_checkins")
        .select("child_id, class_id, checked_out_at, override_reason")
        .eq("church_id", context.churchId)
        .eq("ministry_id", context.ministryId)
        .eq("event_id", selectedEvent.id),
      supabase
        .from("child_pages")
        .select("created_at")
        .eq("church_id", context.churchId)
        .eq("ministry_id", context.ministryId)
        .eq("event_id", selectedEvent.id)
        .is("resolved_at", null)
        .order("created_at"),
    ]);

    if (checkinsError) throw new Error("kids_checkins_unavailable");
    if (pagesError) throw new Error("kids_calls_unavailable");

    const rows = checkins ?? [];
    const presentRows = rows.filter((row) => !row.checked_out_at);
    const childById = new Map(childRows.map((child) => [child.id, child]));
    const presentByClass = new Map<string, number>();

    for (const row of presentRows) {
      if (row.class_id) {
        presentByClass.set(row.class_id, (presentByClass.get(row.class_id) ?? 0) + 1);
      }
    }

    const oldestPageAt = pages?.[0]?.created_at
      ? new Date(pages[0].created_at).getTime()
      : null;

    session = {
      event: {
        id: selectedEvent.id,
        title: selectedEvent.title,
        startsAt: selectedEvent.starts_at,
        endsAt: selectedEvent.ends_at,
        ended: eventEndMs(selectedEvent) < nowMs,
      },
      checkedIn: rows.length,
      present: presentRows.length,
      checkedOut: rows.filter((row) => Boolean(row.checked_out_at)).length,
      presentWithoutClass: presentRows.filter((row) => !row.class_id).length,
      unresolvedCalls: pages?.length ?? 0,
      oldestUnresolvedCallMinutes:
        oldestPageAt === null
          ? null
          : Math.max(0, Math.floor((nowMs - oldestPageAt) / (60 * 1000))),
      pickupOverrides: rows.filter((row) => Boolean(row.override_reason?.trim())).length,
      presentCareSignals: {
        allergyFlags: presentRows.filter((row) =>
          Boolean(childById.get(row.child_id)?.allergies?.trim())
        ).length,
        specialNeedsFlags: presentRows.filter((row) =>
          Boolean(childById.get(row.child_id)?.special_needs?.trim())
        ).length,
      },
      classes: (classes ?? []).map((childClass) => ({
        name: childClass.name,
        present: presentByClass.get(childClass.id) ?? 0,
      })),
    };
  }

  const historySince = new Date(
    nowMs - historyDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: historyRows, error: historyError } = await supabase
    .from("child_checkins")
    .select("event_id, events!inner(id, title, starts_at)")
    .eq("church_id", context.churchId)
    .eq("ministry_id", context.ministryId)
    .gte("events.starts_at", historySince)
    .lt("events.starts_at", nowIso)
    .order("starts_at", { referencedTable: "events", ascending: false })
    .limit(2000);

  if (historyError) throw new Error("kids_history_unavailable");

  const sessionsByEvent = new Map<
    string,
    { id: string; title: string; startsAt: string; checkins: number }
  >();

  for (const row of historyRows ?? []) {
    const event = firstRelated(row.events as unknown as RelatedEvent);
    if (!event) continue;
    const current = sessionsByEvent.get(row.event_id) ?? {
      id: event.id,
      title: event.title,
      startsAt: event.starts_at,
      checkins: 0,
    };
    current.checkins += 1;
    sessionsByEvent.set(row.event_id, current);
  }

  const recentSessions = [...sessionsByEvent.values()]
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, 8);
  const sessionCounts = [...sessionsByEvent.values()].map((item) => item.checkins);
  const totalCheckins = sessionCounts.reduce((sum, value) => sum + value, 0);

  const history = {
    historyDays,
    sessions: sessionsByEvent.size,
    totalCheckins,
    averageCheckinsPerSession:
      sessionsByEvent.size > 0 ? round(totalCheckins / sessionsByEvent.size) : 0,
    peakCheckins: sessionCounts.length > 0 ? Math.max(...sessionCounts) : 0,
    recentSessions,
  };

  const attention: string[] = [];
  if (registration.classes === 0) attention.push("Nenhuma turma está configurada no Kids.");
  if (registration.withoutAuthorizedPickup > 0) {
    attention.push(
      `${registration.withoutAuthorizedPickup} criança(s) ativa(s) estão sem responsável autorizado para retirada.`
    );
  }
  if (registration.missingEmergencyContact > 0) {
    attention.push(
      `${registration.missingEmergencyContact} criança(s) ativa(s) estão com contato de emergência incompleto.`
    );
  }
  if (session?.unresolvedCalls) {
    attention.push(`${session.unresolvedCalls} chamada(s) do Kids ainda estão pendentes.`);
  }
  if (session?.presentWithoutClass) {
    attention.push(`${session.presentWithoutClass} criança(s) presentes estão sem turma definida.`);
  }
  if (session?.event.ended && session.present > 0) {
    attention.push(
      `${session.present} criança(s) continuam com check-in aberto após o fim previsto da sessão.`
    );
  }

  return {
    kind: "kids_operational_insights" as const,
    ministry: context.ministryName,
    generatedAt: nowIso,
    privacy: {
      aggregatedOnly: true,
      note: "O assistente recebe apenas indicadores agregados de saúde, responsáveis, chamadas e operação; detalhes sensíveis de menores não são retornados.",
    },
    registration,
    session,
    history,
    attention,
  };
}
