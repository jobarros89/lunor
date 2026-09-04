import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { WhatsAppPublishButton } from "@/components/escalas/whatsapp-publish-button";

export async function WhatsAppPublishControl({
  churchSlug,
  ministryId,
  eventId,
}: {
  churchSlug: string;
  ministryId: string;
  eventId: string;
}) {
  const tenant = await getTenant(churchSlug);
  const supabase = await createClient();
  const [{ data: membership }, { count }] = await Promise.all([
    supabase
      .from("ministry_members")
      .select("role")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", ministryId)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("church_id", tenant.church.id)
      .eq("event_id", eventId)
      .eq("ministry_id", ministryId)
      .neq("status", "substituido"),
  ]);

  const canManage = tenant.isCoord || membership?.role === "gerente" || membership?.role === "lider";
  if (!canManage || !count) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
      <p className="hidden text-xs text-muted-foreground sm:block">
        Envia confirmação somente para quem ainda está aguardando.
      </p>
      <WhatsAppPublishButton
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        ministryId={ministryId}
        eventId={eventId}
      />
    </div>
  );
}
