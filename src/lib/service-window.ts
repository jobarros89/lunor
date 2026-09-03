export type ServiceWindowInput = {
  eventStart: string;
  eventEnd?: string | null;
  teamArrival?: string | null;
  teamRelease?: string | null;
  assignmentArrival?: string | null;
  assignmentRelease?: string | null;
};

export type EffectiveServiceWindow = {
  arrivalAt: string;
  releaseAt: string | null;
  arrivalSource: "assignment" | "ministry" | "event";
  releaseSource: "assignment" | "ministry" | "event" | null;
};

export function resolveServiceWindow(input: ServiceWindowInput): EffectiveServiceWindow {
  const arrivalAt = input.assignmentArrival ?? input.teamArrival ?? input.eventStart;
  const arrivalSource = input.assignmentArrival
    ? "assignment"
    : input.teamArrival
      ? "ministry"
      : "event";

  const releaseAt = input.assignmentRelease ?? input.teamRelease ?? input.eventEnd ?? null;
  const releaseSource = input.assignmentRelease
    ? "assignment"
    : input.teamRelease
      ? "ministry"
      : input.eventEnd
        ? "event"
        : null;

  return { arrivalAt, releaseAt, arrivalSource, releaseSource };
}

/**
 * O LUNOR hoje persiste os horários operacionais como "wall time" em UTC.
 * Usar getters UTC mantém 09:00 como 09:00 tanto no SSR quanto no navegador,
 * evitando que o cliente aplique o fuso local uma segunda vez.
 */
export function timeLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function toWallTimeInput(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}
