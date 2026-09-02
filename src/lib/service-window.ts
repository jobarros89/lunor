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

export function timeLabel(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
