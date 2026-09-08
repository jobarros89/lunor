import { z } from "zod";
import { runLunorAssistant } from "@/lib/ai/assistant";
import { runDirectOperationalAnswer } from "@/lib/ai/direct-operational-answer";
import { classifyAssistantRequest } from "@/lib/ai/intent-router";
import { tryBuildRecurringEventProposalFromQuestion } from "@/lib/ai/recurring-events";
import { checkAndLogAiUsage } from "@/lib/ai/rate-limit-server";
import { getActiveMinistry } from "@/lib/ministry";
import { createClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

const requestSchema = z.object({
  churchSlug: z.string().trim().min(1).max(100),
  ministryId: z.string().uuid().optional(),
  question: z.string().trim().min(1).max(1_500),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(1_500),
      })
    )
    .max(8)
    .default([]),
});

function recurringProposalError(error: unknown) {
  const code = error instanceof Error ? error.message : "unknown";
  if (code === "recurring_event_permission_denied") {
    return "Encontrei o padrão dos cultos, mas sua conta não tem permissão para criar essa série.";
  }
  if (code === "recurring_event_template_not_found") {
    return "Não encontrei um culto anterior com o mesmo campus, período e dia da semana para usar como modelo.";
  }
  if (code === "recurring_event_campus_ambiguous") {
    return "Encontrei mais de um campus compatível. Informe o nome completo do campus.";
  }
  if (code === "recurring_event_range_invalid") {
    return "O período solicitado já terminou. Informe uma nova data final.";
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: HEADERS });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: HEADERS });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers: HEADERS });
  }

  const tenant = await getTenant(parsed.data.churchSlug);
  if (tenant.guardianOnly) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: HEADERS });
  }

  const ministries = await getActiveMinistry(parsed.data.churchSlug);
  const ministry = parsed.data.ministryId
    ? ministries.options.find((item) => item.id === parsed.data.ministryId)
    : ministries.active;
  if (!ministry?.canManage) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: HEADERS });
  }

  const allowedMinistries = ministries.options
    .filter((item) => item.canManage)
    .map((item) => ({ id: item.id, name: item.name }));

  const context = {
    churchId: tenant.church.id,
    ministryId: ministry.id,
    ministryName: ministry.name,
    allowedMinistries,
  };

  // Criação recorrente de cultos é uma ação estrutural e previsível. O servidor
  // reconhece o padrão antes do modelo, usa os cultos reais como template e
  // devolve apenas uma proposta confirmável. Nenhuma escrita acontece aqui.
  try {
    const recurring = await tryBuildRecurringEventProposalFromQuestion(
      context,
      parsed.data.question
    );
    if (recurring) {
      const count = recurring.occurrences.length;
      const existing = recurring.skippedExisting;
      const answer = count > 0
        ? `Encontrei o padrão existente de ${recurring.title} no campus ${recurring.campus.name}. Preparei ${count} culto${count === 1 ? "" : "s"} que ainda falta${count === 1 ? "" : "m"}${existing > 0 ? ` e preservei ${existing} data${existing === 1 ? "" : "s"} já cadastrada${existing === 1 ? "" : "s"}` : ""}. Revise a série abaixo e confirme para criar.`
        : `Os cultos desse padrão já estão cadastrados no período solicitado. ${existing} data${existing === 1 ? "" : "s"} existente${existing === 1 ? "" : "s"} foi${existing === 1 ? "" : "ram"} preservada${existing === 1 ? "" : "s"}; nenhuma duplicação foi criada.`;
      return Response.json(
        {
          answer,
          model: "lunor-deterministic",
          usedTools: ["recurring_event_template"],
          proposals: [],
          worshipSetlistProposals: [],
          recurringEventProposals: count > 0 ? [recurring] : [],
          scope: {
            ministryId: ministry.id,
            ministryName: ministry.name,
            availableMinistries: allowedMinistries.length,
          },
        },
        { headers: HEADERS }
      );
    }
  } catch (error) {
    const friendly = recurringProposalError(error);
    if (friendly) {
      return Response.json(
        {
          answer: friendly,
          model: "lunor-deterministic",
          usedTools: ["recurring_event_template"],
          proposals: [],
          worshipSetlistProposals: [],
          recurringEventProposals: [],
          scope: {
            ministryId: ministry.id,
            ministryName: ministry.name,
            availableMinistries: allowedMinistries.length,
          },
        },
        { headers: HEADERS }
      );
    }
    console.error(
      "lunor recurring events:",
      error instanceof Error ? error.message : "unknown_error"
    );
  }

  const requestProfile = classifyAssistantRequest({
    question: parsed.data.question,
    currentMinistryId: ministry.id,
    allowedMinistries,
  });

  // Consultas factuais, locais e de alta confiança continuam no caminho
  // determinístico: menor latência, menor custo e resposta diretamente baseada
  // no banco. Análises, planos, ações e qualquer escopo transversal seguem para
  // o orquestrador com ferramentas.
  if (requestProfile.strategy === "direct_lookup") {
    try {
      const direct = await runDirectOperationalAnswer({
        question: parsed.data.question,
        context,
      });
      if (direct) {
        return Response.json(
          {
            answer: direct.answer,
            model: "lunor-deterministic",
            usedTools: direct.usedTools,
            proposals: [],
            worshipSetlistProposals: [],
            recurringEventProposals: [],
            requestProfile,
            scope: {
              ministryId: ministry.id,
              ministryName: ministry.name,
              availableMinistries: allowedMinistries.length,
            },
          },
          { headers: HEADERS }
        );
      }
    } catch (error) {
      console.error(
        "lunor direct assistant:",
        error instanceof Error ? error.message : "unknown_error"
      );
    }
  }

  // O limite é de consumo de IA. Consultas resolvidas de forma determinística
  // acima não consomem a cota do modelo.
  const rateLimitResult = await checkAndLogAiUsage({
    userId: user.id,
    churchId: tenant.church.id,
  });
  if (!rateLimitResult.allowed) {
    const resetAtMs = rateLimitResult.resetAt.getTime();
    const nowMs = Date.now();
    const waitSeconds = Math.ceil((resetAtMs - nowMs) / 1000);
    return Response.json(
      {
        error: "rate_limit_exceeded",
        message: `Limite de 20 mensagens/hora atingido. Tente novamente em ${waitSeconds}s.`,
        resetAt: rateLimitResult.resetAt.toISOString(),
        retryAfter: waitSeconds,
      },
      { status: 429, headers: { ...HEADERS, "Retry-After": waitSeconds.toString() } }
    );
  }

  try {
    const result = await runLunorAssistant({
      question: parsed.data.question,
      history: parsed.data.history,
      context,
      requestProfile,
    });

    return Response.json(
      {
        answer: result.answer,
        model: result.model,
        usedTools: result.usedTools,
        proposals: result.proposals,
        worshipSetlistProposals: result.worshipSetlistProposals,
        recurringEventProposals: [],
        requestProfile,
        scope: {
          ministryId: ministry.id,
          ministryName: ministry.name,
          availableMinistries: allowedMinistries.length,
        },
      },
      { headers: HEADERS }
    );
  } catch (error) {
    console.error(
      "lunor assistant:",
      error instanceof Error ? error.message : "unknown_error"
    );
    return Response.json(
      { error: "assistant_unavailable" },
      { status: 503, headers: HEADERS }
    );
  }
}
