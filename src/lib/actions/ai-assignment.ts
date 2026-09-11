"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { humanReviewSchema, assignmentReviewSnapshot, REVIEW_REQUIRED, REVIEW_CHANGED } from "@/lib/ai/human-review";
import { buildAssignmentProposal } from "@/lib/ai/scheduling";
import { getActiveMinistry } from "@/lib/ministry";
import { getTenant } from "@/lib/tenant";
import { addAssignment } from "@/lib/actions/escalas";
import type { ActionResult } from "@/lib/actions/types";

const schema = z.object({
  review: humanReviewSchema,
  churchSlug: z.string().trim().min(2).max(100),
  ministryId: z.string().uuid(),
  eventId: z.string().uuid(),
  userId: z.string().uuid(),
  roleName: z.string().trim().min(2).max(80),
});

export async function confirmAssistantAssignment(raw: unknown): Promise<ActionResult> {
  const review = humanReviewSchema.safeParse((raw as { review?: unknown } | null)?.review);
  if (!review.success) return { ok: false, error: REVIEW_REQUIRED };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Proposta de escala inválida" };
  const d = parsed.data;

  const tenant = await getTenant(d.churchSlug);
  if (tenant.guardianOnly) return { ok: false, error: "Sem permissão para escalar" };

  const ministries = await getActiveMinistry(d.churchSlug);
  const ministry = ministries.options.find((item) => item.id === d.ministryId);
  if (!ministry?.canManage) return { ok: false, error: "Sem permissão para escalar esta equipe" };

  let proposal;
  try {
    proposal = await buildAssignmentProposal(
      {
        churchId: tenant.church.id,
        ministryId: ministry.id,
        ministryName: ministry.name,
      },
      { eventId: d.eventId, userId: d.userId, roleName: d.roleName }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "proposal_invalid";
    if (message === "candidate_unavailable") {
      return { ok: false, error: "A pessoa ficou indisponível desde a sugestão. Revise a escala." };
    }
    if (message === "candidate_already_assigned_role") {
      return { ok: false, error: "Essa pessoa já está escalada nessa função" };
    }
    return { ok: false, error: "A sugestão mudou. Peça uma nova análise ao LUNOR." };
  }

  if (d.review.snapshot !== assignmentReviewSnapshot(proposal)) {
    return { ok: false, error: REVIEW_CHANGED };
  }

  const result = await addAssignment({
    churchSlug: d.churchSlug,
    churchId: tenant.church.id,
    ministryId: ministry.id,
    eventId: proposal.eventId,
    userId: proposal.userId,
    departmentId: proposal.departmentId,
    roleName: proposal.roleName,
    arrivalTime: "",
    itemsToBring: "",
  });

  if (result.ok) {
    revalidatePath(`/${d.churchSlug}`);
    revalidatePath(`/${d.churchSlug}/assistente`);
  }
  return result;
}

