import { redirect } from "next/navigation";
import { AssistantPanel } from "@/components/ai/assistant-panel";
import {
  McpAccessCard,
  type McpAccessListItem,
} from "@/components/ai/mcp-access-card";
import { getActiveMinistry } from "@/lib/ministry";
import { createClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant";

export default async function AssistantPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  if (tenant.guardianOnly || !tenant.isLeader) redirect(`/${churchSlug}`);

  const { active, options } = await getActiveMinistry(churchSlug);
  const ministry = active?.canManage ? active : options.find((item) => item.canManage);
  if (!ministry) redirect(`/${churchSlug}`);

  const supabase = await createClient();
  const { data: tokens, error: tokenError } = await supabase.rpc("list_mcp_access_tokens", {
    p_church: tenant.church.id,
    p_ministry: ministry.id,
  });
  if (tokenError) console.error("list MCP access tokens:", tokenError.message);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-7 pb-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Inteligência operacional
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Assistente LUNOR</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Pergunte sobre próximos cultos, confirmações, pendências e disponibilidade da equipe.
        </p>
      </header>

      <AssistantPanel
        churchSlug={churchSlug}
        ministryId={ministry.id}
        ministryName={ministry.name}
      />

      <McpAccessCard
        churchSlug={churchSlug}
        ministryId={ministry.id}
        ministryName={ministry.name}
        initialTokens={(tokens ?? []) as McpAccessListItem[]}
      />
    </div>
  );
}
