import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("church_members")
    .select("church_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
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
    <main className="flex min-h-dvh items-start justify-center bg-muted/30 p-6 pt-10">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {membership.role === "admin" ? "Vamos preparar sua igreja" : `Você está entrando em ${church.name}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {membership.role === "admin"
              ? "Só o essencial para começar a organizar a equipe."
              : "Confirme onde você serve e veja suas próximas escalas."}
          </p>
        </div>
        <OnboardingWizard
          mode={membership.role === "admin" ? "owner" : "member"}
          churchName={church.name}
          churchSlug={church.slug}
          ministries={ministries ?? []}
          skills={skills ?? []}
        />
      </div>
    </main>
  );
}
