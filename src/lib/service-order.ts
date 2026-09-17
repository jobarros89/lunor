const SERVICE_TIME_ZONE = "America/Sao_Paulo";

export type ServiceOrderTimingItem = {
  duration_minutes: number;
  scheduled_offset_minutes: number | null;
};

function clockMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SERVICE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function formatServiceOrderClock(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SERVICE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function serviceOrderClockToOffset(startsAt: string, value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (hour > 23 || minute > 59) return null;

  const start = clockMinutes(new Date(startsAt));
  let offset = hour * 60 + minute - start;
  if (offset < 0) offset += 24 * 60;
  return offset;
}

export function serviceOrderOffsetToClock(startsAt: string, offsetMinutes: number) {
  return formatServiceOrderClock(
    new Date(new Date(startsAt).getTime() + offsetMinutes * 60_000)
  );
}

export function scheduleServiceOrder<T extends ServiceOrderTimingItem>(
  items: T[],
  startsAt: string
) {
  const start = new Date(startsAt).getTime();
  let cursorMinutes = 0;

  return items.map((item) => {
    const offsetMinutes = item.scheduled_offset_minutes ?? cursorMinutes;
    const scheduledDate = new Date(start + offsetMinutes * 60_000);
    const endDate = new Date(
      scheduledDate.getTime() + Math.max(item.duration_minutes, 0) * 60_000
    );
    cursorMinutes = offsetMinutes + Math.max(item.duration_minutes, 0);

    return {
      ...item,
      offsetMinutes,
      scheduledDate,
      endDate,
      scheduledAt: formatServiceOrderClock(scheduledDate),
    };
  });
}
