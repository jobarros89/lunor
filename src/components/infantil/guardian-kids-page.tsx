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
  const [{ data: guardians }, { data: receptionRows }] = await Promise.all([
    supabase
      .from("guardians")
      .select("id")
      .eq("church_id", churchId)
      .eq("ministry_id", ministryId)
      .eq("user_id", userId),
    supabase.rpc("guardian_current_kids_reception", {
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

  const reception = receptionRows?.[0] ?? null;

  const { data: checkins } = reception && childIds.length
    ? await supabase
        .from("child_checkins")
        .select("id, child_id, code, pickup_qr_token, checked_out_at, checked_in_at")
        .eq("reception_session_id", reception.session_id)
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
      reception={
        reception
          ? {
              id: reception.session_id,
              title: reception.title,
            }
          : null
      }
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
