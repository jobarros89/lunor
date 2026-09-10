import { getLeadershipInsights } from "@/lib/ai/leadership-insights";
import { getActiveMinistry } from "@/lib/ministry";
import { getTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ churchSlug?: string }> }
) {
  const { churchSlug } = await params;
  if (!churchSlug) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers: HEADERS });
  }

  const tenant = await getTenant(churchSlug);
  if (tenant.guardianOnly) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: HEADERS });
  }

  const ministries = await getActiveMinistry(churchSlug);
  const manageable = ministries.options.filter((item) => item.canManage);
  const current = ministries.active?.canManage
    ? ministries.active
    : manageable[0] ?? null;

  if (!current) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: HEADERS });
  }

  const context = {
    churchId: tenant.church.id,
    ministryId: current.id,
    ministryName: current.name,
    allowedMinistries: manageable.map((item) => ({ id: item.id, name: item.name })),
  };

  const result = await getLeadershipInsights(context, {
    eventLimit: 3,
    limit: 6,
  });

  return Response.json(
    {
      summary: result.summary,
      insights: result.insights,
      generatedAt: result.generatedAt,
    },
    { headers: HEADERS }
  );
}
