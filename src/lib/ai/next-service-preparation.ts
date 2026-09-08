import { getKidsOperationalInsights, isKidsMinistryName } from "@/lib/ai/kids";
import type { SchedulingContext } from "@/lib/ai/scheduling";
import { getTeamWorkloadInsights } from "@/lib/ai/workload-insights";
import { analyzeWorshipSetlist, isWorshipMinistryName } from "@/lib/ai/worship";
import { executeLunorTool } from "@/lib/ai/tools";
import { loadOperationalSummary } from "@/lib/operational-summary-server";

type EventTeamPerson = {
  userId: string;
  name: string;
  roleName: string;
  status: string;
  statusLabel: string;
  arrival: string | null;
  release: string | null;
};

type EventTeamResult = {
  people: EventTeamPerson[];
};

type EventAvailabilityPerson = {
  userId: string;
  name: string;
  role: string;
  status: "available" | "unavailable" | null;
  statusLabel: string;
  source: string | null;
};

type EventAvailabilityResult = {
  people: EventAvailabilityPerson[];
};

type Captured<T> =
  | { available: true; data: T }
  | { available: false; error: string };

type PreparationPriority = "critical" | "high" | "medium" | "info";

type PreparationItem = {
  priority: PreparationPriority;
  area: "scale" | "availability" | "workload" | "worship" | "kids";
  title: string;
  evidence: string;
  suggestedAction: string;
};

async function capture<T>(operation: () => Promise<T>): Promise<Captured<T>> {
  try {
    return { available: true, data: await operation() };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : "unavailable",
    };
  }
}

const PRIORITY_ORDER: Record<PreparationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  info: 3,
};

function compactPeople<T>(people: T[], limit = 12) {
  return {
    total: people.length,
    truncated: people.length > limit,
    people: people.slice(0, limit),
  };
}

export async function prepareNextService(
  context: SchedulingContext,
  { historyDays = 60 }: { historyDays?: number } = {}
) {
  const days = Math.min(Math.max(historyDays, 14), 180);
  const summary = await loadOperationalSummary({
    churchId: context.churchId,
    ministryId: context.ministryId,
    ministryName: context.ministryName,
    limit: 1,
  });
  const event = summary.events[0];

  if (!event) {
    return {
      kind: "next_service_preparation" as const,
      contractVersion: 1 as const,
      status: "no_upcoming_event" as const,
      ministry: { id: context.ministryId, name: context.ministryName },
      generatedAt: new Date().toISOString(),
      message: "Nenhum próximo culto foi encontrado para este ministério.",
      priorities: [],
    };
  }

  const specialtyPromise = isWorshipMinistryName(context.ministryName)
    ? capture(() => analyzeWorshipSetlist(context, { eventId: event.id }))
    : isKidsMinistryName(context.ministryName)
      ? capture(() =>
          getKidsOperationalInsights(context, {
            eventId: event.id,
            historyDays: Math.max(days, 90),
          })
        )
      : Promise.resolve<Captured<null>>({ available: true, data: null });

  const [teamResult, availabilityResult, workloadResult, specialtyResult] =
    await Promise.all([
      capture(async () =>
        (await executeLunorTool("get_event_team", { eventId: event.id }, context)) as EventTeamResult
      ),
      capture(async () =>
        (await executeLunorTool(
          "get_event_availability",
          { eventId: event.id },
          context
        )) as EventAvailabilityResult
      ),
      capture(() =>
        getTeamWorkloadInsights(context, {
          historyDays: days,
          limit: 8,
        })
      ),
      specialtyPromise,
    ]);

  const team = teamResult.available ? teamResult.data.people : [];
  const availability = availabilityResult.available
    ? availabilityResult.data.people
    : [];
  const assignedUserIds = new Set(team.map((person) => person.userId));

  const pendingConfirmation = team.filter((person) => person.status === "convidado");
  const wantsLeader = team.filter((person) => person.status === "falar_lider");
  const substitutionNeeded = team.filter(
    (person) => person.status === "substituicao_solicitada"
  );
  const absent = team.filter((person) => person.status === "ausente");
  const confirmed = team.filter((person) =>
    ["confirmado", "presente"].includes(person.status)
  );
  const assignedUnavailable = availability.filter(
    (person) => assignedUserIds.has(person.userId) && person.status === "unavailable"
  );
  const availableNotAssigned = availability.filter(
    (person) => !assignedUserIds.has(person.userId) && person.status === "available"
  );
  const noAvailabilityResponse = availability.filter(
    (person) => person.status === null
  );

  const priorities: PreparationItem[] = [];

  if (event.readiness === "no_assignments") {
    priorities.push({
      priority: "critical",
      area: "scale",
      title: "Culto ainda sem escala",
      evidence: "Nenhuma pessoa está escalada para o próximo culto neste ministério.",
      suggestedAction: "Montar e revisar a escala antes das demais otimizações.",
    });
  }
  if (substitutionNeeded.length > 0) {
    priorities.push({
      priority: "high",
      area: "scale",
      title: "Substituição pendente",
      evidence: `${substitutionNeeded.length} função(ões) têm solicitação de substituição.`,
      suggestedAction: "Resolver as substituições antes de considerar a escala pronta.",
    });
  }
  if (assignedUnavailable.length > 0) {
    priorities.push({
      priority: "high",
      area: "availability",
      title: "Pessoa escalada está indisponível",
      evidence: `${assignedUnavailable.length} pessoa(s) escalada(s) constam como indisponíveis.`,
      suggestedAction: "Revisar essas posições e avaliar substitutos disponíveis.",
    });
  }
  if (absent.length > 0) {
    priorities.push({
      priority: "high",
      area: "scale",
      title: "Ausência registrada",
      evidence: `${absent.length} pessoa(s) da escala estão marcadas como ausentes.`,
      suggestedAction: "Cobrir as funções afetadas antes do culto.",
    });
  }
  if (wantsLeader.length > 0) {
    priorities.push({
      priority: "medium",
      area: "scale",
      title: "Voluntário pediu contato da liderança",
      evidence: `${wantsLeader.length} pessoa(s) estão com status “Falar com líder”.`,
      suggestedAction: "Fazer o contato antes de fechar a escala.",
    });
  }
  if (pendingConfirmation.length > 0) {
    priorities.push({
      priority: "medium",
      area: "scale",
      title: "Confirmações pendentes",
      evidence: `${pendingConfirmation.length} atribuição(ões) ainda aguardam confirmação.`,
      suggestedAction: "Cobrar confirmação e manter alternativas em vista.",
    });
  }
  if (availability.length > 0 && noAvailabilityResponse.length / availability.length >= 0.4) {
    priorities.push({
      priority: "medium",
      area: "availability",
      title: "Baixa cobertura de disponibilidade",
      evidence: `${noAvailabilityResponse.length} de ${availability.length} membros ainda estão sem resposta de disponibilidade.`,
      suggestedAction: "Solicitar disponibilidade ao restante do time antes de preencher lacunas.",
    });
  }

  if (workloadResult.available) {
    const workload = workloadResult.data;
    if (workload.summary.concentrationSignal === "concentrated") {
      priorities.push({
        priority: "medium",
        area: "workload",
        title: "Carga concentrada no time",
        evidence: `Os 20% mais acionados concentram ${workload.summary.concentrationSharePercent}% das participações confirmadas no período.`,
        suggestedAction: "Considerar rodízio com pessoas menos utilizadas, respeitando disponibilidade e função.",
      });
    }
  }

  if (specialtyResult.available && specialtyResult.data) {
    const specialty = specialtyResult.data as Record<string, unknown>;
    if (specialty.kind === "worship_setlist_analysis") {
      const worshipSummary = specialty.summary as {
        songs: number;
        missingKey: number;
        missingBpm: number;
        missingTimeSignature: number;
        largeTempoChanges: number;
        farKeyChanges: number;
      };
      if (worshipSummary.songs === 0) {
        priorities.push({
          priority: "high",
          area: "worship",
          title: "Repertório ainda não montado",
          evidence: "O próximo culto não possui músicas no repertório.",
          suggestedAction: "Montar uma proposta de repertório e revisar com a liderança do Louvor.",
        });
      }
      const missingMetadata =
        worshipSummary.missingKey +
        worshipSummary.missingBpm +
        worshipSummary.missingTimeSignature;
      if (missingMetadata > 0) {
        priorities.push({
          priority: "medium",
          area: "worship",
          title: "Metadados musicais incompletos",
          evidence: `${missingMetadata} campo(s) de tom, BPM ou compasso estão ausentes no repertório.`,
          suggestedAction: "Completar os dados antes do ensaio para melhorar preparação e transições.",
        });
      }
      if (worshipSummary.largeTempoChanges + worshipSummary.farKeyChanges > 0) {
        priorities.push({
          priority: "info",
          area: "worship",
          title: "Transições musicais merecem revisão",
          evidence: `${worshipSummary.largeTempoChanges} mudança(s) grande(s) de tempo e ${worshipSummary.farKeyChanges} mudança(s) distante(s) de tom foram detectadas.`,
          suggestedAction: "Revisar ordem, tons e transições no ensaio; trate isso como sinal musical, não como regra absoluta.",
        });
      }
    }

    if (specialty.kind === "kids_operational_insights") {
      const attention = Array.isArray(specialty.attention)
        ? specialty.attention.filter((item): item is string => typeof item === "string")
        : [];
      if (attention.length > 0) {
        priorities.push({
          priority: "medium",
          area: "kids",
          title: "Pendências operacionais do Kids",
          evidence: `${attention.length} sinal(is) agregado(s) de atenção foram encontrados.`,
          suggestedAction: "Revisar os indicadores protegidos do Kids antes de abrir a recepção.",
        });
      }
    }
  }

  priorities.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const dataWarnings = [
    !teamResult.available ? `equipe:${teamResult.error}` : null,
    !availabilityResult.available ? `disponibilidade:${availabilityResult.error}` : null,
    !workloadResult.available ? `carga:${workloadResult.error}` : null,
    !specialtyResult.available ? `modulo:${specialtyResult.error}` : null,
  ].filter((item): item is string => Boolean(item));

  return {
    kind: "next_service_preparation" as const,
    contractVersion: 1 as const,
    status: "ready" as const,
    generatedAt: new Date().toISOString(),
    ministry: { id: context.ministryId, name: context.ministryName },
    event: {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      readiness: event.readiness,
    },
    scale: {
      totalAssignments: team.length,
      confirmed: confirmed.length,
      pendingConfirmation: compactPeople(
        pendingConfirmation.map(({ name, roleName, statusLabel }) => ({ name, roleName, statusLabel }))
      ),
      wantsLeader: compactPeople(
        wantsLeader.map(({ name, roleName, statusLabel }) => ({ name, roleName, statusLabel }))
      ),
      substitutionNeeded: compactPeople(
        substitutionNeeded.map(({ name, roleName, statusLabel }) => ({ name, roleName, statusLabel }))
      ),
      absent: compactPeople(
        absent.map(({ name, roleName, statusLabel }) => ({ name, roleName, statusLabel }))
      ),
      assignments: team.slice(0, 24).map(({ name, roleName, statusLabel, arrival, release }) => ({
        name,
        roleName,
        statusLabel,
        arrival,
        release,
      })),
      assignmentsTruncated: team.length > 24,
    },
    availability: {
      ...event.availability,
      availableNotAssigned: compactPeople(
        availableNotAssigned.map(({ name, role, statusLabel }) => ({ name, role, statusLabel }))
      ),
      assignedUnavailable: compactPeople(
        assignedUnavailable.map(({ name, role, statusLabel }) => ({ name, role, statusLabel }))
      ),
      noResponse: noAvailabilityResponse.length,
    },
    workload: workloadResult.available
      ? {
          summary: workloadResult.data.summary,
          highLoad: workloadResult.data.highLoad,
          rotationOpportunities: workloadResult.data.rotationOpportunities,
          guidance: workloadResult.data.guidance,
        }
      : null,
    specialty: specialtyResult.available ? specialtyResult.data : null,
    priorities,
    dataWarnings,
    guidance:
      "Use este pacote como briefing operacional do próximo culto. Priorize riscos concretos, diferencie ausência de resposta de indisponibilidade e não transforme sinais de carga em julgamento sobre pessoas.",
  };
}
