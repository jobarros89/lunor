import { z } from "zod";
import type { LunorAiTool } from "@/lib/ai/cloudflare";
import {
  buildAssignmentProposal,
  loadScheduleCandidates,
  type AssignmentProposal,
  type SchedulingContext,
} from "@/lib/ai/scheduling";
import {
  buildScheduleDraftFromPreviousService,
  isScheduleDraft,
  type ScheduleDraft,
} from "@/lib/ai/schedule-draft";
import {
  analyzeWorshipSetlist,
  getWorshipLibraryInsights,
} from "@/lib/ai/worship";
import {
  buildWorshipSetlistProposal,
  isWorshipSetlistProposal,
  type WorshipSetlistProposal,
} from "@/lib/ai/worship-setlist-proposal";

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
  {
    name: "draft_schedule_from_previous_service",
    description:
      "Monta um RASCUNHO completo para um culto usando a escala anterior do mesmo ministério apenas como referência de funções. Revalida disponibilidade e experiência e nunca grava a escala automaticamente.",
    parameters: {
      type: "object",
      properties: {
        eventId: { type: "string", format: "uuid", description: "ID do culto que receberá o rascunho." },
        maxRoles: {
          type: "integer",
          minimum: 1,
          maximum: 20,
          description: "Máximo de funções a sugerir. Padrão: 12.",
        },
      },
      required: ["eventId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_worship_library_insights",
    description:
      "Consulta o acervo ativo do Louvor com tom, BPM, compasso, materiais e uso recente. Use para analisar repetição, metadados faltantes ou sugerir repertório somente com músicas reais do acervo. Não altera dados.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Máximo de músicas retornadas. Padrão: 40.",
        },
        historyDays: {
          type: "integer",
          minimum: 14,
          maximum: 365,
          description: "Janela de histórico para uso das músicas. Padrão: 120 dias.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "analyze_worship_setlist",
    description:
      "Analisa o repertório real de um culto do Louvor: sequência, tons efetivos, BPM, compasso, repetição recente e mudanças entre músicas. Não altera o repertório.",
    parameters: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          format: "uuid",
          description: "ID do culto cujo repertório será analisado.",
        },
      },
      required: ["eventId"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_worship_setlist",
    description:
      "Cria uma PROPOSTA visual de repertório para um culto usando exclusivamente IDs de músicas reais retornadas pelo acervo. Use somente depois de get_worship_library_insights. Não altera o repertório; a gravação exige confirmação explícita do líder.",
    parameters: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          format: "uuid",
          description: "ID do culto que receberia o repertório após confirmação humana.",
        },
        songIds: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: { type: "string", format: "uuid" },
          description: "IDs das músicas reais do acervo na ordem sugerida.",
        },
      },
      required: ["eventId", "songIds"],
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
const draftSchema = z.object({
  eventId: z.string().uuid(),
  maxRoles: z.number().int().min(1).max(20).optional(),
});
const worshipLibrarySchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  historyDays: z.number().int().min(14).max(365).optional(),
});
const worshipSetlistSchema = z.object({
  eventId: z.string().uuid(),
});
const worshipSetlistProposalSchema = z.object({
  eventId: z.string().uuid(),
  songIds: z
    .array(z.string().uuid())
    .min(2)
    .max(6)
    .refine((songIds) => new Set(songIds).size === songIds.length, {
      message: "As músicas da proposta não podem se repetir",
    }),
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
    case "draft_schedule_from_previous_service": {
      const input = draftSchema.parse(args);
      return buildScheduleDraftFromPreviousService(context, {
        eventId: input.eventId,
        maxRoles: input.maxRoles ?? 12,
      });
    }
    case "get_worship_library_insights": {
      const input = worshipLibrarySchema.parse(args);
      return getWorshipLibraryInsights(context, {
        limit: input.limit ?? 40,
        historyDays: input.historyDays ?? 120,
      });
    }
    case "analyze_worship_setlist":
      return analyzeWorshipSetlist(context, worshipSetlistSchema.parse(args));
    case "propose_worship_setlist":
      return buildWorshipSetlistProposal(
        context,
        worshipSetlistProposalSchema.parse(args)
      );
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

export { isScheduleDraft, isWorshipSetlistProposal };
export type { ScheduleDraft, WorshipSetlistProposal };
