import { createClient } from "@/lib/supabase/server";
import { formatAge } from "@/lib/infantil";
import { GuardianKidsDashboard } from "@/components/infantil/guardian-kids-dashboard";

type GuardianCheckin = {
  id: string;
  child_id: string;
  code: string;
  pickup_qr_token: string;
  checked_out_at: string | null;
  checked_in_at: string;
};

export async function GuardianKidsPage({
  churchSlug,
  churchId,
  ministryId,
  userId,
}: {
  churchSlug: string;
  churchId: string;
  ministryId: string;
  userId: string;
}) {
  const supabase = await createClient();
  const [{ data: guardians }, { data: events }] = await Promise.all([
    supabase
      .from("guardians")
      .select("id")
      .eq("church_id", churchId)
      .eq("ministry_id", ministryId)
      .eq("user_id", userId),
    supabase.rpc("guardian_current_kids_event", {
      p_church: churchId,
      p_ministry: ministryId,
    }),
  ]);

  const guardianIds = (guardians ?? []).map((guardian) => guardian.id);
  const { data: links } = guardianIds.length
    ? await supabase
        .from("child_guardians")
        .select("child_id")
        .in("guardian_id", guardianIds)
    : { data: [] };
  const childIds = [...new Set((links ?? []).map((link) => link.child_id))];
  const { data: children } = childIds.length
    ? await supabase
        .from("children")
        .select("id, full_name, birth_date")
        .eq("church_id", churchId)
        .eq("ministry_id", ministryId)
        .eq("active", true)
        .in("id", childIds)
        .order("full_name")
    : { data: [] };

  // A RPC já aplica a regra operacional completa: janela automática OU
  // recepção explicitamente aberta pela equipe. Não filtre novamente por horário
  // aqui, senão uma recepção aberta antecipadamente desaparece para a família.
  const event = events?.[0] ?? null;

  const { data: checkins } = event && childIds.length
    ? await supabase
        .from("child_checkins")
        .select("id, child_id, code, pickup_qr_token, checked_out_at, checked_in_at")
        .eq("event_id", event.id)
        .in("child_id", childIds)
        .order("checked_in_at", { ascending: false })
    : { data: [] };

  const latestByChild = new Map<string, GuardianCheckin>();
  for (const checkin of (checkins ?? []) as GuardianCheckin[]) {
    if (!latestByChild.has(checkin.child_id)) latestByChild.set(checkin.child_id, checkin);
  }

  return (
    <GuardianKidsDashboard
      churchSlug={churchSlug}
      churchId={churchId}
      ministryId={ministryId}
      event={event ? { id: event.id, title: event.title } : null}
      familyChildren={(children ?? []).map((child) => {
        const checkin = latestByChild.get(child.id);
        return {
          id: child.id,
          fullName: child.full_name,
          age: formatAge(child.birth_date),
          checkin: checkin
            ? {
                id: checkin.id,
                code: checkin.code,
                pickupToken: checkin.pickup_qr_token,
                checkedOut: !!checkin.checked_out_at,
              }
            : null,
        };
      })}
    />
  );
}
