const DEFAULT_APP_URL = "https://lunorservice.com";

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL).replace(/\/$/, "");
}

function churchPath(churchSlug: string, suffix: string): string {
  const slug = encodeURIComponent(churchSlug.trim());
  return `${baseUrl()}/${slug}${suffix}`;
}

export function buildScheduleDeepLink(churchSlug: string, eventId: string): string {
  return churchPath(churchSlug, `/escalas/${encodeURIComponent(eventId)}`);
}

export function buildAvailabilityDeepLink(churchSlug: string): string {
  return churchPath(churchSlug, "/disponibilidade");
}
