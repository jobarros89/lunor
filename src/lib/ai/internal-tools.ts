import { z } from "zod";
import type { LunorAiTool } from "@/lib/ai/cloudflare";
import {
  buildAssignmentProposal,
  loadScheduleCandidates,
  type AssignmentProposal,
  type SchedulingContext,
} from "@/lib/ai/scheduling";

const INTERNAL_TOOLS: LunorAiTool[] = [
  {
    name: "get_schedule_candidates",
    description:
      "Retorna candidatos do ministério para uma função em um culto, priorizando disponibilidade informada e experiência anterior na função. Não altera a escala.",
    parameters: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          format: "uuid",
          description: "ID do culto.",
        },
        roleName: {
          type: "string",
          minLength: 2,
          maxLength: 80,
          description: "Função a preencher, por exemplo Baixo, Teclado ou DM.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 12,
          description: "Quantidade máxima de candidatos. Padrão: 6.",
        },
      },
      required: ["eventId"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_assignment",
    description:
      "Cria somente uma PROPOSTA de escala para revisão humana. Use depois de consultar candidatos. Esta ferramenta não grava nada no LUNOR.",
    parameters: {
      type: "object",
      properties: {
        eventId: { type: "string", format: "uuid" },
        userId: { type: "string", format: "uuid" },
        roleName: { type: "string", minLength: 2, maxLength: 80 },
      },
      required: ["eventId", "userId", "roleName"],
      additionalProperties: false,
    },
  },
];

const candidatesSchema = z.object({
  eventId: z.string().uuid(),
  roleName: z.string().trim().min(2).max(80).optional(),
  limit: z.number().int().min(1).max(12).optional(),
});
const proposalSchema = z.object({
  eventId: z.string().uuid(),
  userId: z.string().uuid(),
  roleName: z.string().trim().min(2).max(80),
});

export function internalAiTools(): LunorAiTool[] {
  return INTERNAL_TOOLS;
}

export function isInternalAiTool(name: string) {
  return INTERNAL_TOOLS.some((tool) => tool.name === name);
}

export async function executeInternalAiTool(
  name: string,
  args: Record<string, unknown>,
  context: SchedulingContext
): Promise<unknown> {
  switch (name) {
    case "get_schedule_candidates": {
      const input = candidatesSchema.parse(args);
      return loadScheduleCandidates(context, {
        eventId: input.eventId,
        roleName: input.roleName,
        limit: input.limit ?? 6,
      });
    }
    case "propose_assignment":
      return buildAssignmentProposal(context, proposalSchema.parse(args));
    default:
      throw new Error("unknown_internal_tool");
  }
}

export function isAssignmentProposal(value: unknown): value is AssignmentProposal {
  if (!value || typeof value !== "object") return false;
  const proposal = value as Record<string, unknown>;
  return (
    proposal.kind === "assignment" &&
    typeof proposal.eventId === "string" &&
    typeof proposal.userId === "string" &&
    typeof proposal.roleName === "string"
  );
}
