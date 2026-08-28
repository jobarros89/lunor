export const SERVICE_PERIOD_LABELS: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

export function servicePeriodLabel(period: string | null | undefined) {
  if (!period) return null;
  return SERVICE_PERIOD_LABELS[period] ?? period;
}

export function inferServicePeriod(localDateTime: string) {
  if (!localDateTime) return null;
  const match = localDateTime.match(/T(\d{2}):/);
  if (!match) return null;
  const hour = Number(match[1]);
  if (!Number.isFinite(hour)) return null;
  if (hour < 12) return "manha" as const;
  if (hour < 18) return "tarde" as const;
  return "noite" as const;
}

export function eventContextLabel({
  campusName,
  servicePeriod,
  fallbackLocation,
}: {
  campusName?: string | null;
  servicePeriod?: string | null;
  fallbackLocation?: string | null;
}) {
  return [
    campusName || fallbackLocation || null,
    servicePeriodLabel(servicePeriod),
  ]
    .filter(Boolean)
    .join(" · ");
}
