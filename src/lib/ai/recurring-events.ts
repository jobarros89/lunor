import { createClient } from "@/lib/supabase/server";
import type { SchedulingContext } from "@/lib/ai/scheduling";

export const LUNOR_EVENT_TIME_ZONE = "America/Sao_Paulo";

export type ServicePeriod = "manha" | "tarde" | "noite";
export type WeekdayName =
  | "domingo"
  | "segunda"
  | "terca"
  | "quarta"
  | "quinta"
  | "sexta"
  | "sabado";

export type RecurringEventOccurrence = {
  startsAt: string;
  endsAt: string | null;
};

export type RecurringEventProposal = {
  kind: "recurring_event_proposal";
  templateEventId: string;
  title: string;
  campus: { id: string; name: string };
  servicePeriod: ServicePeriod;
  weekday: WeekdayName;
  location: string | null;
  templateStartsAt: string;
  occurrences: RecurringEventOccurrence[];
  skippedExisting: number;
};

type ProposalInput = {
  campusName: string;
  servicePeriod: ServicePeriod;
  weekday: WeekdayName;
  until: string;
  startDate?: string;
};

type TemplateEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  campus_id: string | null;
  service_period: ServicePeriod | null;
  ministry_id: string | null;
  location: string | null;
};

const WEEKDAY_INDEX: Record<WeekdayName, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function dateParts(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LUNOR_EVENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function localDateKey(value: string | Date) {
  const { year, month, day } = dateParts(value);
  return `${year}-${month}-${day}`;
}

export function localClockKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LUNOR_EVENT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}:${get("second")}`;
}

export function localWeekdayIndex(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: LUNOR_EVENT_TIME_ZONE,
    weekday: "short",
  }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(label);
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekdayForDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

function offsetMinutes(date: Date) {
  const zone = new Intl.DateTimeFormat("en-US", {
    timeZone: LUNOR_EVENT_TIME_ZONE,
    timeZoneName: "longOffset",
    hour: "2-digit",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = zone?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) return -180;
  const sign = match[1] === "+" ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

export function zonedLocalToIso(dateKey: string, clock: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute, second] = clock.split(":").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second || 0);
  const guess = new Date(localAsUtc);
  const firstOffset = offsetMinutes(guess);
  const first = new Date(localAsUtc - firstOffset * 60_000);
  const secondOffset = offsetMinutes(first);
  return new Date(localAsUtc - secondOffset * 60_000).toISOString();
}

function resolveUntil(until: string, today: string) {
  if (normalize(until) === "end_of_year") return `${today.slice(0, 4)}-12-31`;
  if (!DATE_RE.test(until)) throw new Error("recurring_event_until_invalid");
  return until;
}

async function assertCanUseTemplate(
  context: SchedulingContext,
  ministryId: string | null
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");

  const [{ data: isMaster }, { data: churchMembership }] = await Promise.all([
    supabase.rpc("is_platform_admin"),
    supabase
      .from("church_members")
      .select("role")
      .eq("church_id", context.churchId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  if (
    isMaster ||
    churchMembership?.role === "admin" ||
    churchMembership?.role === "coordenador"
  ) {
    return;
  }

  if (!ministryId || ministryId !== context.ministryId) {
    throw new Error("recurring_event_permission_denied");
  }
  const { data: membership } = await supabase
    .from("ministry_members")
    .select("role")
    .eq("church_id", context.churchId)
    .eq("ministry_id", ministryId)
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (membership?.role !== "gerente" && membership?.role !== "lider") {
    throw new Error("recurring_event_permission_denied");
  }
}

export async function buildRecurringEventProposal(
  context: SchedulingContext,
  input: ProposalInput
): Promise<RecurringEventProposal> {
  const supabase = await createClient();
  const requestedCampus = normalize(input.campusName);
  const { data: campuses, error: campusError } = await supabase
    .from("campuses")
    .select("id, name")
    .eq("church_id", context.churchId)
    .eq("active", true)
    .order("name");
  if (campusError) throw new Error("recurring_event_campus_unavailable");

  const exact = (campuses ?? []).filter(
    (campus) => normalize(campus.name) === requestedCampus
  );
  const partial = (campuses ?? []).filter((campus) =>
    normalize(campus.name).includes(requestedCampus)
  );
  const candidates = exact.length ? exact : partial;
  if (candidates.length === 0) throw new Error("recurring_event_campus_not_found");
  if (candidates.length > 1) throw new Error("recurring_event_campus_ambiguous");
  const campus = candidates[0];

  const { data: templateRows, error: templateError } = await supabase
    .from("events")
    .select(
      "id, title, starts_at, ends_at, campus_id, service_period, ministry_id, location"
    )
    .eq("church_id", context.churchId)
    .eq("campus_id", campus.id)
    .eq("service_period", input.servicePeriod)
    .order("starts_at", { ascending: false })
    .limit(80);
  if (templateError) throw new Error("recurring_event_template_unavailable");

  const requestedWeekday = WEEKDAY_INDEX[input.weekday];
  const template = (templateRows ?? []).find(
    (event) => localWeekdayIndex(event.starts_at) === requestedWeekday
  ) as TemplateEvent | undefined;
  if (!template) throw new Error("recurring_event_template_not_found");
  await assertCanUseTemplate(context, template.ministry_id);

  const today = localDateKey(new Date());
  const startDate = input.startDate && DATE_RE.test(input.startDate)
    ? input.startDate < today
      ? today
      : input.startDate
    : today;
  const until = resolveUntil(input.until, today);
  if (until < startDate) throw new Error("recurring_event_range_invalid");

  const rangeEndExclusive = addDays(until, 1);
  const { data: existingRows, error: existingError } = await supabase
    .from("events")
    .select("starts_at")
    .eq("church_id", context.churchId)
    .eq("campus_id", campus.id)
    .eq("service_period", input.servicePeriod)
    .gte("starts_at", zonedLocalToIso(startDate, "00:00:00"))
    .lt("starts_at", zonedLocalToIso(rangeEndExclusive, "00:00:00"));
  if (existingError) throw new Error("recurring_event_existing_unavailable");
  const existingDates = new Set((existingRows ?? []).map((row) => localDateKey(row.starts_at)));

  let firstDate = startDate;
  for (let i = 0; i < 7 && weekdayForDateKey(firstDate) !== requestedWeekday; i += 1) {
    firstDate = addDays(firstDate, 1);
  }

  const clock = localClockKey(template.starts_at);
  const durationMs = template.ends_at
    ? Math.max(0, new Date(template.ends_at).getTime() - new Date(template.starts_at).getTime())
    : null;
  const occurrences: RecurringEventOccurrence[] = [];
  let skippedExisting = 0;

  for (let dateKey = firstDate; dateKey <= until; dateKey = addDays(dateKey, 7)) {
    if (existingDates.has(dateKey)) {
      skippedExisting += 1;
      continue;
    }
    const startsAt = zonedLocalToIso(dateKey, clock);
    const endsAt = durationMs
      ? new Date(new Date(startsAt).getTime() + durationMs).toISOString()
      : null;
    occurrences.push({ startsAt, endsAt });
    if (occurrences.length > 60) throw new Error("recurring_event_range_too_large");
  }

  return {
    kind: "recurring_event_proposal",
    templateEventId: template.id,
    title: template.title,
    campus: { id: campus.id, name: campus.name },
    servicePeriod: input.servicePeriod,
    weekday: input.weekday,
    location: template.location,
    templateStartsAt: template.starts_at,
    occurrences,
    skippedExisting,
  };
}

export function isRecurringEventProposal(value: unknown): value is RecurringEventProposal {
  if (!value || typeof value !== "object") return false;
  const proposal = value as Record<string, unknown>;
  return (
    proposal.kind === "recurring_event_proposal" &&
    typeof proposal.templateEventId === "string" &&
    Array.isArray(proposal.occurrences)
  );
}
