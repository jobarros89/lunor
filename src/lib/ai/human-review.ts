import { z } from "zod";

// Only the authenticated confirmation actions accept this contract. It is never
// offered as a model tool. A chat message cannot satisfy the review step.
export const humanReviewSchema = z.object({
  validated: z.literal(true),
  snapshot: z.string().min(1).max(20_000),
});

export const REVIEW_REQUIRED = "Revise e valide a proposta antes de aprovar a alteração.";
export const REVIEW_CHANGED = "Os dados mudaram desde a sugestão. Gere uma nova proposta e revise novamente.";

export function assignmentReviewSnapshot(p: {
  eventId: string; eventTitle: string; startsAt: string;
  userId: string; userName: string; roleName: string;
  departmentId: string | null; availability: string;
}) {
  return JSON.stringify([p.eventId, p.eventTitle, p.startsAt, p.userId,
    p.userName, p.roleName, p.departmentId, p.availability]);
}

export function setlistReviewSnapshot(p: {
  event: { id: string; title: string; startsAt: string };
  songs: Array<{ songId: string; title: string; defaultKey: string | null;
    bpm: number | null; timeSignature: string | null }>;
}) {
  return JSON.stringify([p.event.id, p.event.title, p.event.startsAt,
    p.songs.map(s => [s.songId, s.title, s.defaultKey, s.bpm, s.timeSignature])]);
}

export function recurringReviewSnapshot(p: {
  templateEventId: string; title: string; campus: { id: string };
  servicePeriod: string; templateStartsAt: string; location: string | null;
  occurrences: Array<{ startsAt: string; endsAt: string | null }>;
}) {
  return JSON.stringify([p.templateEventId, p.title, p.campus.id, p.servicePeriod,
    p.templateStartsAt, p.location, p.occurrences.map(o => [o.startsAt, o.endsAt])]);
}
