export const APP_TIME_ZONE = "America/Sao_Paulo";

const LOCAL_DATE_TIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const EXPLICIT_TIME_ZONE_RE = /(?:Z|[+-]\d{2}:\d{2})$/i;

function timeZoneOffsetMs(timestamp: number, timeZone: string) {
  const rounded = Math.trunc(timestamp / 1000) * 1000;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(rounded));

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return representedAsUtc - rounded;
}

/**
 * Interpreta valores vindos de input[type="datetime-local"] no fuso da aplicação.
 * Valores que já possuem Z/offset explícito são preservados como instantes absolutos.
 */
export function parseAppLocalDateTime(
  value: string,
  timeZone = APP_TIME_ZONE
): Date | null {
  const raw = value.trim();
  if (!raw) return null;

  if (EXPLICIT_TIME_ZONE_RE.test(raw)) {
    const explicit = new Date(raw);
    return Number.isNaN(explicit.getTime()) ? null : explicit;
  }

  const match = raw.match(LOCAL_DATE_TIME_RE);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "0", msText = "0"] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(msText.padEnd(3, "0"));

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const normalized = new Date(wallClockUtc);
  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() !== month - 1 ||
    normalized.getUTCDate() !== day
  ) {
    return null;
  }

  let instant = wallClockUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = wallClockUtc - timeZoneOffsetMs(instant, timeZone);
    if (next === instant) break;
    instant = next;
  }

  const result = new Date(instant);
  return Number.isNaN(result.getTime()) ? null : result;
}
