import { z } from "zod";
import { runLunorAssistant } from "@/lib/ai/assistant";
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

  try {
    const result = await runLunorAssistant({
      question: parsed.data.question,
      history: parsed.data.history,
      context: {
        churchId: tenant.church.id,
        ministryId: ministry.id,
        ministryName: ministry.name,
      },
    });

    return Response.json(
      {
        answer: result.answer,
        model: result.model,
        usedTools: result.usedTools,
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
