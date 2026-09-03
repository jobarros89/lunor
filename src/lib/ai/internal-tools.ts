import { z } from "zod";
import type { LunorAiTool } from "@/lib/ai/cloudflare";
import {
  assistantScopeDescription,
  getAssistantAppContext,
  getAssistantAppOperationalOverview,
  resolveAssistantMinistryContext,
} from "@/lib/ai/app-context";
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
import { getKidsOperationalInsights } from "@/lib/ai/kids";
import { executeLunorTool } from "@/lib/ai/tools";

const ministryIdProperty = {
  type: "string",
  format: "uuid",
  description:
    "ID de um ministério autorizado retornado por get_app_context. Se omitido, usa o contexto visual atual.",
} as const;

const INTERNAL_TOOLS: LunorAiTool[] = [
  {
    name: "get_app_context",
    description:
      "Mostra a visão transversal do Assistente LUNOR: ministério visual atual e todos os ministérios que o usuário pode gerenciar. Use antes de responder perguntas que atravessam módulos ou mencionam outro ministério.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_app_operational_overview",
    description:
      "Consulta um panorama operacional dos ministérios que o usuário pode gerenciar. Use para perguntas amplas sobre a igreja, pendências gerais, próximos cultos ou preparação de reunião de líderes. Somente leitura.",
    parameters: {
      type: "object",
      properties: {
        eventLimit: {
          type: "integer",
          minimum: 1,
          maximum: 4,
          description: "Quantidade de próximos cultos por ministério. Padrão: 2.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_ministry_operational_summary",
    description:
      "Consulta o resumo operacional de um ministério autorizado, mesmo que ele não seja o ministério atualmente aberto na interface. Somente leitura.",
    parameters: {
      type: "object",
      properties: {
        ministryId: ministryIdProperty,
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 8,
          description: "Quantidade de próximos cultos. Padrão: 4.",
        },
      },
      required: ["ministryId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_ministry_event_team",
    description:
      "Lista a equipe escalada de um culto em um ministério autorizado, mesmo fora do contexto visual atual. Somente leitura.",
    parameters: {
      type: "object",
      properties: {
        ministryId: ministryIdProperty,
        eventId: { type: "string", format: "uuid", description: "ID do culto." },
      },
      required: ["ministryId", "eventId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_ministry_event_availability",
    description:
      "Consulta a disponibilidade da equipe de um culto em um ministério autorizado, mesmo fora do contexto visual atual. Somente leitura.",
    parameters: {
      type: "object",
      properties: {
        ministryId: ministryIdProperty,
        eventId: { type: "string", format: "uuid", description: "ID do culto." },
      },
      required: ["ministryId", "eventId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_schedule_candidates",
    description:
      "Retorna candidatos de um ministério autorizado para uma função em um culto, priorizando disponibilidade informada e experiência anterior. Somente leitura; não altera a escala.",
    parameters: {
      type: "object",
      properties: {
        ministryId: ministryIdProperty,
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
      "Cria somente uma PROPOSTA de escala para revisão humana no ministério atualmente aberto. Use depois de consultar candidatos. Esta ferramenta não grava nada no LUNOR.",
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
      "Monta um RASCUNHO completo para um culto do ministério atualmente aberto usando a escala anterior apenas como referência de funções. Nunca grava automaticamente.",
    parameters: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          format: "uuid",
          description: "ID do culto que receberá o rascunho.",
        },
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
      "Consulta o acervo ativo de um ministério de Louvor autorizado com tom, BPM, compasso, materiais e uso recente. Pode ser usado mesmo se outra tela estiver aberta. Não altera dados.",
    parameters: {
      type: "object",
      properties: {
        ministryId: ministryIdProperty,
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
      "Analisa o repertório real de um culto em um ministério de Louvor autorizado: sequência, tons, BPM, compasso, repetição e transições. Pode ser usado fora da tela do Louvor. Não altera o repertório.",
    parameters: {
      type: "object",
      properties: {
        ministryId: ministryIdProperty,
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
      "Cria uma PROPOSTA visual de repertório apenas quando o Louvor é o ministério atualmente aberto, usando exclusivamente músicas reais do acervo. Não grava; exige confirmação explícita do líder.",
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
  {
    name: "get_kids_operational_insights",
    description:
      "Consulta indicadores agregados e protegidos de um ministério Kids/Infantil autorizado, mesmo se outra tela estiver aberta. Nunca retorna nomes, códigos de retirada, telefones nem detalhes médicos. Não altera dados.",
    parameters: {
      type: "object",
      properties: {
        ministryId: ministryIdProperty,
        eventId: {
          type: "string",
          format: "uuid",
          description:
            "Culto específico. Se omitido, usa a sessão atual ou a próxima sessão disponível.",
        },
        historyDays: {
          type: "integer",
          minimum: 14,
          maximum: 365,
          description: "Janela para frequência histórica. Padrão: 90 dias.",
        },
      },
      additionalProperties: false,
    },
  },
];

const ministryTargetSchema = z.object({ ministryId: z.string().uuid().optional() });
const appOverviewSchema = z.object({
  eventLimit: z.number().int().min(1).max(4).optional(),
});
const ministryOperationalSchema = z.object({
  ministryId: z.string().uuid(),
  limit: z.number().int().min(1).max(8).optional(),
});
const ministryEventSchema = z.object({
  ministryId: z.string().uuid(),
  eventId: z.string().uuid(),
});
const candidatesSchema = ministryTargetSchema.extend({
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
const worshipLibrarySchema = ministryTargetSchema.extend({
  limit: z.number().int().min(1).max(100).optional(),
  historyDays: z.number().int().min(14).max(365).optional(),
});
const worshipSetlistSchema = ministryTargetSchema.extend({
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
const kidsOperationalSchema = ministryTargetSchema.extend({
  eventId: z.string().uuid().optional(),
  historyDays: z.number().int().min(14).max(365).optional(),
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
    case "get_app_context":
      return getAssistantAppContext(context);
    case "get_app_operational_overview": {
      const input = appOverviewSchema.parse(args);
      return getAssistantAppOperationalOverview(context, {
        eventLimit: input.eventLimit ?? 2,
      });
    }
    case "get_ministry_operational_summary": {
      const input = ministryOperationalSchema.parse(args);
      const target = resolveAssistantMinistryContext(context, input.ministryId);
      return executeLunorTool(
        "get_operational_summary",
        { limit: input.limit ?? 4 },
        target
      );
    }
    case "get_ministry_event_team": {
      const input = ministryEventSchema.parse(args);
      const target = resolveAssistantMinistryContext(context, input.ministryId);
      return executeLunorTool("get_event_team", { eventId: input.eventId }, target);
    }
    case "get_ministry_event_availability": {
      const input = ministryEventSchema.parse(args);
      const target = resolveAssistantMinistryContext(context, input.ministryId);
      return executeLunorTool(
        "get_event_availability",
        { eventId: input.eventId },
        target
      );
    }
    case "get_schedule_candidates": {
      const input = candidatesSchema.parse(args);
      const target = resolveAssistantMinistryContext(context, input.ministryId);
      return loadScheduleCandidates(target, {
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
      const target = resolveAssistantMinistryContext(context, input.ministryId);
      return getWorshipLibraryInsights(target, {
        limit: input.limit ?? 40,
        historyDays: input.historyDays ?? 120,
      });
    }
    case "analyze_worship_setlist": {
      const input = worshipSetlistSchema.parse(args);
      const target = resolveAssistantMinistryContext(context, input.ministryId);
      return analyzeWorshipSetlist(target, { eventId: input.eventId });
    }
    case "propose_worship_setlist":
      return buildWorshipSetlistProposal(
        context,
        worshipSetlistProposalSchema.parse(args)
      );
    case "get_kids_operational_insights": {
      const input = kidsOperationalSchema.parse(args);
      const target = resolveAssistantMinistryContext(context, input.ministryId);
      return getKidsOperationalInsights(target, {
        eventId: input.eventId,
        historyDays: input.historyDays ?? 90,
      });
    }
    default:
      throw new Error("unknown_internal_tool");
  }
}

export function internalAssistantScopeDescription(context: SchedulingContext) {
  return assistantScopeDescription(context);
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
