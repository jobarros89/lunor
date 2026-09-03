import { loadScheduleCandidates, type AssignmentProposal, type SchedulingContext } from "@/lib/ai/scheduling";
import { createClient } from "@/lib/supabase/server";

export type ScheduleDraftSkippedRole = {
  roleName: string;
  reason: "already_filled" | "no_eligible_candidate";
};

export type ScheduleDraft = {
  kind: "schedule_draft";
  event: { id: string; title: string; startsAt: string };
  referenceEvent: { id: string; title: string; startsAt: string } | null;
  proposals: AssignmentProposal[];
  skippedRoles: ScheduleDraftSkippedRole[];
};

type RelatedEvent =
  | { id: string; title: string; starts_at: string }
  | { id: string; title: string; starts_at: string }[]
  | null;

function firstRelatedEvent(value: RelatedEvent) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

function candidateRationale(candidate: {
  availabilityLabel: string;
  matchingRoleExperience: number;
}) {
  const parts = [candidate.availabilityLabel];
  if (candidate.matchingRoleExperience > 0) {
    parts.push(
      `${candidate.matchingRoleExperience} escala${candidate.matchingRoleExperience === 1 ? "" : "s"} anterior${candidate.matchingRoleExperience === 1 ? "" : "es"} nessa função`
    );
  }
  parts.push("rascunho baseado na escala anterior");
  return parts.join(" · ");
}

/**
 * Monta um rascunho sem gravar dados. A escala anterior do mesmo ministério é
 * usada somente como referência de funções. Cada pessoa sugerida é revalidada
 * por disponibilidade e experiência através de loadScheduleCandidates.
 */
export async function buildScheduleDraftFromPreviousService(
  context: SchedulingContext,
  input: { eventId: string; maxRoles?: number }
): Promise<ScheduleDraft> {
  const supabase = await createClient();
  const maxRoles = Math.min(Math.max(input.maxRoles ?? 12, 1), 20);

  const [{ data: event }, { data: currentAssignments }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at")
      .eq("church_id", context.churchId)
      .eq("id", input.eventId)
      .maybeSingle(),
    supabase
      .from("assignments")
      .select("user_id, role_name")
      .eq("church_id", context.churchId)
      .eq("ministry_id", context.ministryId)
      .eq("event_id", input.eventId)
      .neq("status", "substituido"),
  ]);
  if (!event) throw new Error("event_not_found");

  const { data: history, error } = await supabase
    .from("assignments")
    .select("event_id, user_id, role_name, events!inner(id, title, starts_at)")
    .eq("church_id", context.churchId)
    .eq("ministry_id", context.ministryId)
    .neq("status", "substituido")
    .lt("events.starts_at", event.starts_at)
    .order("starts_at", { referencedTable: "events", ascending: false })
    .limit(250);
  if (error) throw new Error("schedule_reference_unavailable");

  const firstHistory = history?.[0] ?? null;
  const previousEvent = firstHistory
    ? firstRelatedEvent(firstHistory.events as unknown as RelatedEvent)
    : null;
  if (!firstHistory || !previousEvent) {
    return {
      kind: "schedule_draft",
      event: { id: event.id, title: event.title, startsAt: event.starts_at },
      referenceEvent: null,
      proposals: [],
      skippedRoles: [],
    };
  }

  const referenceRows = (history ?? []).filter((row) => row.event_id === firstHistory.event_id);
  const roleMap = new Map<string, string>();
  for (const row of referenceRows) {
    const roleName = row.role_name?.trim();
    if (roleName) roleMap.set(normalize(roleName), roleName);
  }
  const referenceRoles = [...roleMap.values()].slice(0, maxRoles);

  const currentRoleNames = new Set(
    (currentAssignments ?? []).map((assignment) => normalize(assignment.role_name))
  );
  const chosenUsers = new Set((currentAssignments ?? []).map((assignment) => assignment.user_id));
  const proposals: AssignmentProposal[] = [];
  const skippedRoles: ScheduleDraftSkippedRole[] = [];

  for (const roleName of referenceRoles) {
    if (currentRoleNames.has(normalize(roleName))) {
      skippedRoles.push({ roleName, reason: "already_filled" });
      continue;
    }

    const candidateResult = await loadScheduleCandidates(context, {
      eventId: event.id,
      roleName,
      limit: 12,
    });
    const candidate = candidateResult.candidates.find(
      (item) => item.eligible && !chosenUsers.has(item.userId)
    );
    if (!candidate) {
      skippedRoles.push({ roleName, reason: "no_eligible_candidate" });
      continue;
    }

    chosenUsers.add(candidate.userId);
    proposals.push({
      kind: "assignment",
      eventId: candidateResult.event.id,
      eventTitle: candidateResult.event.title,
      startsAt: candidateResult.event.startsAt,
      userId: candidate.userId,
      userName: candidate.name,
      roleName,
      departmentId: candidateResult.matchedDepartment?.id ?? null,
      departmentName: candidateResult.matchedDepartment?.name ?? null,
      availability: candidate.availability === "available" ? "available" : "unknown",
      availabilityLabel: candidate.availabilityLabel,
      rationale: candidateRationale(candidate),
    });
  }

  return {
    kind: "schedule_draft",
    event: { id: event.id, title: event.title, startsAt: event.starts_at },
    referenceEvent: {
      id: previousEvent.id,
      title: previousEvent.title,
      startsAt: previousEvent.starts_at,
    },
    proposals,
    skippedRoles,
  };
}

export function isScheduleDraft(value: unknown): value is ScheduleDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return draft.kind === "schedule_draft" && Array.isArray(draft.proposals);
}
