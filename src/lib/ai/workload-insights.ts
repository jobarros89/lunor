import { createClient } from "@/lib/supabase/server";
import type { SchedulingContext } from "@/lib/ai/scheduling";

type ProfileRelation =
  | { full_name: string }
  | { full_name: string }[]
  | null;

type EventRelation =
  | { id: string; starts_at: string }
  | { id: string; starts_at: string }[]
  | null;

type MemberRow = {
  user_id: string;
  profiles: ProfileRelation;
};

type AssignmentRow = {
  user_id: string;
  status: string;
  events: EventRelation;
};

export type WorkloadMember = {
  userId: string;
  name: string;
};

export type WorkloadParticipation = {
  userId: string;
  eventId: string;
  startsAt: string;
};

function firstRelation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function buildTeamWorkloadInsights({
  context,
  members,
  participations,
  historyDays = 60,
  limit = 8,
  generatedAt = new Date().toISOString(),
}: {
  context: SchedulingContext;
  members: WorkloadMember[];
  participations: WorkloadParticipation[];
  historyDays?: number;
  limit?: number;
  generatedAt?: string;
}) {
  const days = Math.min(Math.max(historyDays, 14), 180);
  const resultLimit = Math.min(Math.max(limit, 1), 12);
  const serviceIdsByUser = new Map<string, Set<string>>();
  const lastServedAtByUser = new Map<string, string>();

  for (const participation of participations) {
    const services = serviceIdsByUser.get(participation.userId) ?? new Set<string>();
    services.add(participation.eventId);
    serviceIdsByUser.set(participation.userId, services);

    const previous = lastServedAtByUser.get(participation.userId);
    if (!previous || participation.startsAt > previous) {
      lastServedAtByUser.set(participation.userId, participation.startsAt);
    }
  }

  const workload = members
    .map((member) => ({
      ...member,
      services: serviceIdsByUser.get(member.userId)?.size ?? 0,
      lastServedAt: lastServedAtByUser.get(member.userId) ?? null,
    }))
    .sort((a, b) => b.services - a.services || a.name.localeCompare(b.name, "pt-BR"));

  const totalParticipations = workload.reduce((sum, member) => sum + member.services, 0);
  const averageServices = members.length > 0 ? totalParticipations / members.length : 0;
  const highLoadThreshold = Math.max(3, Math.ceil(averageServices * 1.5));
  const lowLoadThreshold = Math.max(0, Math.floor(averageServices * 0.5));
  const topGroupSize = workload.length > 0 ? Math.max(1, Math.ceil(workload.length * 0.2)) : 0;
  const topGroupParticipations = workload
    .slice(0, topGroupSize)
    .reduce((sum, member) => sum + member.services, 0);
  const concentrationSharePercent = percent(topGroupParticipations, totalParticipations);

  const highLoad = workload
    .filter((member) => member.services >= highLoadThreshold)
    .slice(0, resultLimit)
    .map((member) => ({
      userId: member.userId,
      name: member.name,
      services: member.services,
      lastServedAt: member.lastServedAt,
      relativeToAverage:
        averageServices > 0 ? Number((member.services / averageServices).toFixed(1)) : null,
    }));

  const rotationOpportunities = workload
    .filter((member) => member.services <= lowLoadThreshold)
    .sort((a, b) => a.services - b.services || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, resultLimit)
    .map((member) => ({
      userId: member.userId,
      name: member.name,
      services: member.services,
      lastServedAt: member.lastServedAt,
    }));

  const maxServices = workload[0]?.services ?? 0;
  const minServices = workload.at(-1)?.services ?? 0;

  return {
    kind: "team_workload_insights" as const,
    ministry: { id: context.ministryId, name: context.ministryName },
    historyDays: days,
    generatedAt,
    summary: {
      activeMembers: members.length,
      totalConfirmedServiceParticipations: totalParticipations,
      averageServicesPerMember: Number(averageServices.toFixed(1)),
      highLoadThreshold,
      lowLoadThreshold,
      highLoadMembers: highLoad.length,
      rotationOpportunities: rotationOpportunities.length,
      workloadSpread: maxServices - minServices,
      concentrationSharePercent,
      concentrationSignal:
        members.length >= 5 && totalParticipations >= 5 && concentrationSharePercent >= 50
          ? "concentrated"
          : "balanced_or_insufficient_data",
    },
    highLoad,
    rotationOpportunities,
    guidance:
      "Carga é um sinal operacional baseado apenas em participações confirmadas/presentes no período. Não presume disponibilidade futura, preferência pessoal ou capacidade individual.",
  };
}

export async function getTeamWorkloadInsights(
  context: SchedulingContext,
  { historyDays = 60, limit = 8 }: { historyDays?: number; limit?: number } = {}
) {
  const days = Math.min(Math.max(historyDays, 14), 180);
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const supabase = await createClient();

  const [membersResult, assignmentsResult] = await Promise.all([
    supabase
      .from("ministry_members")
      .select("user_id, profiles!inner(full_name)")
      .eq("church_id", context.churchId)
      .eq("ministry_id", context.ministryId)
      .eq("active", true),
    supabase
      .from("assignments")
      .select("user_id, status, events!inner(id, starts_at)")
      .eq("church_id", context.churchId)
      .eq("ministry_id", context.ministryId)
      .in("status", ["confirmado", "presente"])
      .gte("events.starts_at", since.toISOString())
      .lte("events.starts_at", now.toISOString())
      .limit(1000),
  ]);

  if (membersResult.error || assignmentsResult.error) {
    throw new Error("team_workload_unavailable");
  }

  const members: WorkloadMember[] = (
    (membersResult.data ?? []) as unknown as MemberRow[]
  ).map((row) => {
    const profile = firstRelation(row.profiles);
    return {
      userId: row.user_id,
      name: profile?.full_name ?? "Sem nome",
    };
  });

  const participations: WorkloadParticipation[] = [];
  for (const assignment of (assignmentsResult.data ?? []) as unknown as AssignmentRow[]) {
    const event = firstRelation(assignment.events);
    if (!event) continue;
    participations.push({
      userId: assignment.user_id,
      eventId: event.id,
      startsAt: event.starts_at,
    });
  }

  return buildTeamWorkloadInsights({
    context,
    members,
    participations,
    historyDays: days,
    limit,
    generatedAt: now.toISOString(),
  });
}
