/**
 * Cálculo do radar de distribuição de carga.
 *
 * Tudo aqui é puro: recebe roster + escalas + `now` e devolve o resumo.
 * Sem Supabase, sem Date.now() — para ser testável e reaproveitável entre
 * a página /distribuicao (igreja inteira) e o painel da Home (setor do líder).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Status que não contam como serviço prestado. */
const NON_SERVING_STATUS = new Set([
  "ausente",
  "substituicao_solicitada",
  "substituido",
]);

/** A partir de quantos serviços em 30 dias a pessoa entra em "atenção". */
export const ATTENTION_LAST30 = 4;
/** A partir de quantas semanas seguidas servindo a pessoa entra em "atenção". */
export const ATTENTION_CONSECUTIVE_WEEKS = 4;
/** A partir de quantos dias sem servir a pessoa entra em "reconectar". */
export const RECONNECT_DAYS = 42;

export type DistributionSignal = "attention" | "balanced" | "reconnect";

export type DistributionMember = {
  userId: string;
  name: string;
};

export type DistributionAssignment = {
  userId: string;
  status: string;
  eventId: string;
  eventTitle: string;
  startsAt: string;
};

export type DistributionEventRef = {
  id: string;
  title: string;
  startsAt: string;
};

export type DistributionPerson = {
  userId: string;
  name: string;
  last30: number;
  last60: number;
  last90: number;
  upcoming: number;
  consecutiveWeeks: number;
  lastServedAt: string | null;
  /** dias desde o último serviço; null quando nunca serviu na janela analisada */
  daysSinceLast: number | null;
  nextEvent: DistributionEventRef | null;
  signal: DistributionSignal;
};

export type DistributionWeekPoint = {
  /** segunda-feira da semana, em ISO date (YYYY-MM-DD) */
  weekStart: string;
  /** rótulo curto para eixo: "01/09" */
  label: string;
  /** total de serviços prestados pelo time naquela semana */
  count: number;
  /** quantas pessoas distintas serviram naquela semana */
  people: number;
};

export type DistributionOverview = {
  contractVersion: 1;
  generatedAt: string;
  people: DistributionPerson[];
  attention: DistributionPerson[];
  reconnect: DistributionPerson[];
  balancedCount: number;
  /** série semanal do time, da mais antiga para a mais recente */
  weeks: DistributionWeekPoint[];
  /**
   * 0–100. 100 = carga perfeitamente dividida entre quem serviu.
   * `null` quando não houve nenhum serviço na janela (não há o que medir).
   * Baseado no inverso do coeficiente de Gini sobre os serviços dos últimos 30 dias.
   */
  balanceIndex: number | null;
  totalServices30: number;
  activeMembers: number;
  /** pessoas que não serviram nenhuma vez nos últimos 30 dias */
  idleMembers: number;
};

export function startOfWeek(date: Date): Date {
  const value = new Date(date);
  const day = value.getDay();
  const distance = day === 0 ? 6 : day - 1;
  value.setDate(value.getDate() - distance);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function weekKey(date: Date): string {
  const start = startOfWeek(date);
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function countConsecutiveWeeks(dates: string[], now: Date): number {
  if (dates.length === 0) return 0;
  const servedWeeks = new Set(dates.map((iso) => weekKey(new Date(iso))));
  let cursor = startOfWeek(now);
  let count = 0;

  // Se ainda não serviu na semana atual, a sequência pode continuar da anterior.
  if (!servedWeeks.has(weekKey(cursor))) {
    cursor = new Date(cursor.getTime() - 7 * DAY_MS);
  }

  while (servedWeeks.has(weekKey(cursor))) {
    count += 1;
    cursor = new Date(cursor.getTime() - 7 * DAY_MS);
  }
  return count;
}

/**
 * Coeficiente de Gini (0 = igualdade perfeita, 1 = uma pessoa concentra tudo).
 * Devolve null quando não há carga nenhuma para medir.
 */
export function giniCoefficient(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 1) return 0;

  let weighted = 0;
  for (let index = 0; index < n; index += 1) {
    weighted += (index + 1) * sorted[index];
  }
  const gini = (2 * weighted) / (n * total) - (n + 1) / n;
  // Ruído de ponto flutuante pode empurrar levemente para fora de [0, 1].
  return Math.min(1, Math.max(0, gini));
}

export function buildDistributionOverview({
  members,
  assignments,
  now,
  weeksBack = 8,
}: {
  members: DistributionMember[];
  assignments: DistributionAssignment[];
  now: Date;
  weeksBack?: number;
}): DistributionOverview {
  const nowMs = now.getTime();
  const last30From = nowMs - 30 * DAY_MS;
  const last60From = nowMs - 60 * DAY_MS;
  const last90From = nowMs - 90 * DAY_MS;

  const byUser = new Map<string, DistributionAssignment[]>();
  for (const assignment of assignments) {
    if (NON_SERVING_STATUS.has(assignment.status)) continue;
    const list = byUser.get(assignment.userId);
    if (list) list.push(assignment);
    else byUser.set(assignment.userId, [assignment]);
  }

  const people: DistributionPerson[] = members.map((member) => {
    const own = byUser.get(member.userId) ?? [];
    const past = own.filter((item) => new Date(item.startsAt).getTime() <= nowMs);
    const future = own
      .filter((item) => new Date(item.startsAt).getTime() > nowMs)
      .sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      );

    const pastMs = past.map((item) => new Date(item.startsAt).getTime());
    const last30 = pastMs.filter((value) => value >= last30From).length;
    const last60 = pastMs.filter((value) => value >= last60From).length;
    const last90 = pastMs.filter((value) => value >= last90From).length;

    const lastServedMs = pastMs.length > 0 ? Math.max(...pastMs) : null;
    const lastServedAt = lastServedMs ? new Date(lastServedMs).toISOString() : null;
    const daysSinceLast =
      lastServedMs === null
        ? null
        : Math.max(0, Math.floor((nowMs - lastServedMs) / DAY_MS));

    const consecutiveWeeks = countConsecutiveWeeks(
      past.map((item) => item.startsAt),
      now
    );

    let signal: DistributionSignal = "balanced";
    if (last30 >= ATTENTION_LAST30 || consecutiveWeeks >= ATTENTION_CONSECUTIVE_WEEKS) {
      signal = "attention";
    } else if (
      (daysSinceLast === null || daysSinceLast >= RECONNECT_DAYS) &&
      future.length === 0
    ) {
      signal = "reconnect";
    }

    const next = future[0];

    return {
      userId: member.userId,
      name: member.name?.trim() || "Sem nome",
      last30,
      last60,
      last90,
      upcoming: future.length,
      consecutiveWeeks,
      lastServedAt,
      daysSinceLast,
      nextEvent: next
        ? { id: next.eventId, title: next.eventTitle, startsAt: next.startsAt }
        : null,
      signal,
    };
  });

  const attention = people
    .filter((person) => person.signal === "attention")
    .sort(
      (a, b) =>
        b.last30 - a.last30 ||
        b.consecutiveWeeks - a.consecutiveWeeks ||
        a.name.localeCompare(b.name, "pt-BR")
    );

  const reconnect = people
    .filter((person) => person.signal === "reconnect")
    .sort((a, b) => {
      const aDays = a.daysSinceLast ?? Number.POSITIVE_INFINITY;
      const bDays = b.daysSinceLast ?? Number.POSITIVE_INFINITY;
      return bDays - aDays || a.name.localeCompare(b.name, "pt-BR");
    });

  const balancedCount = people.filter((person) => person.signal === "balanced").length;

  // Série semanal: da semana mais antiga para a atual.
  const weekBuckets = new Map<string, Set<string>>();
  const weekCounts = new Map<string, number>();
  const currentWeekStart = startOfWeek(now);
  const orderedKeys: string[] = [];
  for (let offset = weeksBack - 1; offset >= 0; offset -= 1) {
    const weekDate = new Date(currentWeekStart.getTime() - offset * 7 * DAY_MS);
    const key = weekKey(weekDate);
    orderedKeys.push(key);
    weekBuckets.set(key, new Set());
    weekCounts.set(key, 0);
  }

  for (const list of byUser.values()) {
    for (const assignment of list) {
      const startMs = new Date(assignment.startsAt).getTime();
      if (startMs > nowMs) continue;
      const key = weekKey(new Date(startMs));
      if (!weekCounts.has(key)) continue;
      weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
      weekBuckets.get(key)?.add(assignment.userId);
    }
  }

  const weeks: DistributionWeekPoint[] = orderedKeys.map((key) => {
    const [, month, day] = key.split("-");
    return {
      weekStart: key,
      label: `${day}/${month}`,
      count: weekCounts.get(key) ?? 0,
      people: weekBuckets.get(key)?.size ?? 0,
    };
  });

  const loads = people.map((person) => person.last30);
  const totalServices30 = loads.reduce((sum, value) => sum + value, 0);
  const gini = giniCoefficient(loads);
  const balanceIndex = gini === null ? null : Math.round((1 - gini) * 100);

  return {
    contractVersion: 1,
    generatedAt: now.toISOString(),
    people,
    attention,
    reconnect,
    balancedCount,
    weeks,
    balanceIndex,
    totalServices30,
    activeMembers: people.length,
    idleMembers: people.filter((person) => person.last30 === 0).length,
  };
}

export function relativeLastService(daysSinceLast: number | null): string {
  if (daysSinceLast === null) return "Sem serviço na janela";
  if (daysSinceLast === 0) return "Serviu hoje";
  if (daysSinceLast === 1) return "Serviu ontem";
  if (daysSinceLast < 7) return `Serviu há ${daysSinceLast} dias`;
  const weeks = Math.floor(daysSinceLast / 7);
  if (weeks === 1) return "Serviu há 1 semana";
  return `Serviu há ${weeks} semanas`;
}
