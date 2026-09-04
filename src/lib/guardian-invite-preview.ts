import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const FAMILY_INVITE_COOKIE = "lunor_family_invite";

export type GuardianInvitePreview = {
  status: "valid" | "expired" | "used" | "invalid";
  guardianName: string | null;
  invitedEmail: string | null;
  churchName: string | null;
};

export async function getGuardianInvitePreview(): Promise<GuardianInvitePreview | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(FAMILY_INVITE_COOKIE)?.value ?? "";
  if (!/^[a-f0-9]{48}$/i.test(token)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guardian_invite_preview", {
    p_token: token,
  });

  if (error) return null;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  const status = String(row.status ?? "invalid");
  if (!["valid", "expired", "used", "invalid"].includes(status)) return null;

  return {
    status: status as GuardianInvitePreview["status"],
    guardianName: row.guardian_name ?? null,
    invitedEmail: row.invited_email ?? null,
    churchName: row.church_name ?? null,
  };
}
