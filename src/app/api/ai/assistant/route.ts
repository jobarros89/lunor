import { z } from "zod";
import { runLunorAssistant } from "@/lib/ai/assistant";
import { runDirectOperationalAnswer } from "@/lib/ai/direct-operational-answer";
import { runDirectScheduleDraft } from "@/lib/ai/direct-schedule-draft";
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

  const context = {
    churchId: tenant.church.id,
    ministryId: ministry.id,
    ministryName: ministry.name,
  };

  // A vertical de rascunho de escala também tem um caminho determinístico.
  // Assim o atalho principal continua útil mesmo se ambos os modelos oscilarem.
  try {
    const draft = await runDirectScheduleDraft({
      question: parsed.data.question,
      context,
    });
    if (draft) {
      return Response.json(
        {
          answer: draft.answer,
          model: "lunor-deterministic",
          usedTools: draft.usedTools,
          proposals: draft.proposals,
          worshipSetlistProposals: [],
          scope: { ministryId: ministry.id, ministryName: ministry.name },
        },
        { headers: HEADERS }
      );
    }
  } catch (error) {
    console.error(
      "lunor direct schedule draft:",
      error instanceof Error ? error.message : "unknown_error"
    );
  }

  // Perguntas operacionais recorrentes dos chips da UI não precisam gastar uma
  // inferência para descobrir quais ferramentas chamar. Elas continuam usando
  // os mesmos dados/RLS e funcionam mesmo se o provedor de LLM estiver oscilando.
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
          scope: { ministryId: ministry.id, ministryName: ministry.name },
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

  try {
    const result = await runLunorAssistant({
      question: parsed.data.question,
      history: parsed.data.history,
      context,
    });

    return Response.json(
      {
        answer: result.answer,
        model: result.model,
        usedTools: result.usedTools,
        proposals: result.proposals,
        worshipSetlistProposals: result.worshipSetlistProposals,
        scope: { ministryId: ministry.id, ministryName: ministry.name },
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
