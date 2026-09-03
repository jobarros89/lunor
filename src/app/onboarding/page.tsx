import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { BrandLockup } from "@/components/brand-lockup";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ igreja?: string }>;
}) {
  const { igreja } = await searchParams;
  const scopedChurchId = igreja && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(igreja)
    ? igreja
    : null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membershipBase = supabase
    .from("church_members")
    .select("church_id, role")
    .eq("user_id", user.id)
    .eq("status", "active");
  const membershipQuery = scopedChurchId
    ? membershipBase.eq("church_id", scopedChurchId)
    : membershipBase;
  const { data: membership } = await membershipQuery
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/comecar");

  const [{ data: church }, { data: ministries }, { data: skills }] = await Promise.all([
    supabase.from("churches").select("name, slug, settings").eq("id", membership.church_id).single(),
    supabase.from("ministries").select("id, name").eq("church_id", membership.church_id).order("name"),
    supabase.from("skills").select("slug, name").eq("church_id", membership.church_id).order("name"),
  ]);
  if (!church) redirect("/comecar");

  return (
    <main className="flex min-h-dvh items-start justify-center bg-[#08080a] px-5 py-10 text-[#f4f3ef] sm:items-center">
      <div className="w-full max-w-lg space-y-6">
        <div className="space-y-4 text-center">
          <BrandLockup className="items-center [&_span]:text-[#f4f3ef] [&_span:last-child]:text-zinc-400" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {membership.role === "admin" ? "Vamos preparar sua igreja" : `Bem-vindo à ${church.name}`}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {membership.role === "admin"
                ? "Configure o essencial para começar a usar o LUNOR."
                : "Confirme onde você serve para concluir seu acesso ao LUNOR."}
            </p>
          </div>
        </div>
        <OnboardingWizard
          mode={membership.role === "admin" ? "owner" : "member"}
          churchId={membership.church_id}
          churchName={church.name}
          churchSlug={church.slug}
          ministries={ministries ?? []}
          skills={skills ?? []}
        />
      </div>
    </main>
  );
}
