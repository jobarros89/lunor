import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { DepartmentsManager } from "@/components/admin/departments-manager";

export default async function OndeServirPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  if (!tenant.isLeader) redirect(`/${churchSlug}`);

  const supabase = await createClient();
  const cid = tenant.church.id;

  let allowedMinistryIds: string[] | null = null;
  if (!tenant.isCoord) {
    const { data: memberships } = await supabase
      .from("ministry_members")
      .select("ministry_id")
      .eq("church_id", cid)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .in("role", ["gerente", "lider"]);
    allowedMinistryIds = (memberships ?? []).map((m) => m.ministry_id);
  }

  let ministriesQuery = supabase
    .from("ministries")
    .select("id, name")
    .eq("church_id", cid)
    .order("name");
  if (allowedMinistryIds) {
    ministriesQuery = ministriesQuery.in(
      "id",
      allowedMinistryIds.length > 0 ? allowedMinistryIds : ["00000000-0000-0000-0000-000000000000"]
    );
  }

  const { data: ministries } = await ministriesQuery;
  const ministryIds = (ministries ?? []).map((m) => m.id);

  let departmentsQuery = supabase
    .from("departments")
    .select("id, name, ministry_id")
    .eq("church_id", cid)
    .order("name");
  if (!tenant.isCoord) {
    departmentsQuery = departmentsQuery.in(
      "ministry_id",
      ministryIds.length > 0 ? ministryIds : ["00000000-0000-0000-0000-000000000000"]
    );
  }
  const { data: departments } = await departmentsQuery;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Onde servir?</h1>
        <p className="text-muted-foreground">
          Crie subdivisões opcionais de cada ministério, como Vocal, Banda ou Berçário.
        </p>
      </div>

      <DepartmentsManager
        churchSlug={churchSlug}
        churchId={cid}
        departments={departments ?? []}
        ministries={ministries ?? []}
      />
    </div>
  );
}
