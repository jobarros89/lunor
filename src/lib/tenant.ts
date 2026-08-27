import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type MinistryRole = "gerente" | "lider" | "instrutor" | "voluntario";

export type TenantContext = {
  userId: string;
  church: { id: string; name: string; slug: string; invite_code: string };
  role: "admin" | "coordenador" | "member";
  profile: {
    full_name: string;
    avatar_url: string | null;
    onboarding_completed: boolean;
  };
  ministryRoles: MinistryRole[];
  /** admin ou coordenador da igreja (gestão no nível da igreja toda) */
  isCoord: boolean;
  /** admin/coordenador da igreja ou gerente de algum ministério */
  isManager: boolean;
  /** isManager ou líder de algum ministério */
  isLeader: boolean;
  /** true quando o acesso vem do usuário master (super-admin de plataforma) */
  isMaster: boolean;
};

// cache() deduplica por request: layout e page compartilham a mesma consulta
export const getTenant = cache(
  async (churchSlug: string): Promise<TenantContext> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data } = await supabase
      .from("church_members")
      .select(
        "role, onboarding_completed_at, churches!inner(id, name, slug, invite_code), profiles!inner(full_name, avatar_url, onboarding_completed)"
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("churches.slug", churchSlug)
      .maybeSingle();

    // Usuário master: opera em QUALQUER igreja, mesmo sem ser membro dela.
    if (!data) {
      const { data: isMaster } = await supabase.rpc("is_platform_admin");
      if (isMaster) {
        const { data: church } = await supabase
          .from("churches")
          .select("id, name, slug, invite_code")
          .eq("slug", churchSlug)
          .maybeSingle();
        if (!church) notFound();

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, onboarding_completed")
          .eq("id", user.id)
          .single();

        return {
          userId: user.id,
          church: church as TenantContext["church"],
          role: "admin",
          profile: (profile ?? {
            full_name: "",
            avatar_url: null,
            onboarding_completed: true,
          }) as TenantContext["profile"],
          ministryRoles: ["gerente"],
          isCoord: true,
          isManager: true,
          isLeader: true,
          isMaster: true,
        };
      }
      notFound();
    }

    const church = data.churches as unknown as TenantContext["church"];
    const profile = data.profiles as unknown as TenantContext["profile"];

    // Onboarding é por igreja. A fonte de verdade é church_members.onboarding_completed_at.
    // profiles.onboarding_completed permanece apenas por compatibilidade com dados legados.
    if (!data.onboarding_completed_at) {
      const { data: isMaster } = await supabase.rpc("is_platform_admin");
      if (!isMaster) redirect(`/onboarding?igreja=${church.id}`);
    }

    const { data: memberships } = await supabase
      .from("ministry_members")
      .select("role")
      .eq("church_id", church.id)
      .eq("user_id", user.id)
      .eq("active", true);

    const ministryRoles = (memberships ?? []).map(
      (m) => m.role as MinistryRole
    );
    // admin e coordenador têm gestão no nível da igreja toda
    const isCoord = data.role === "admin" || data.role === "coordenador";
    const isManager = isCoord || ministryRoles.includes("gerente");
    const isLeader = isManager || ministryRoles.includes("lider");

    return {
      userId: user.id,
      church,
      role: data.role,
      profile,
      ministryRoles,
      isCoord,
      isManager,
      isLeader,
      isMaster: false,
    };
  }
);
