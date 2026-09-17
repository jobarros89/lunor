import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type MinistryRole = "gerente" | "lider" | "instrutor" | "voluntario";

export type TenantMinistryMembership = {
  id: string;
  name: string;
  slug: string;
  module_key: "generic" | "worship" | "kids";
  role: MinistryRole;
};

export type TenantContext = {
  userId: string;
  church: { id: string; name: string; slug: string };
  role: "admin" | "coordenador" | "member";
  profile: {
    full_name: string;
    avatar_url: string | null;
    onboarding_completed: boolean;
  };
  ministryRoles: MinistryRole[];
  /** ministérios ativos do usuário; reaproveitado no shell para evitar nova consulta */
  ministryMemberships: TenantMinistryMembership[];
  /** admin ou coordenador da igreja (gestão no nível da igreja toda) */
  isCoord: boolean;
  /** admin/coordenador da igreja ou gerente de algum ministério */
  isManager: boolean;
  /** isManager ou líder de algum ministério */
  isLeader: boolean;
  /** conta vinculada como responsável por ao menos uma criança */
  isGuardian: boolean;
  /** responsável sem vínculo de equipe/voluntariado nesta igreja */
  guardianOnly: boolean;
  /** true quando o acesso vem do usuário master (super-admin de plataforma) */
  isMaster: boolean;
};

// cache() deduplica por request: layout e page compartilham a mesma consulta.
// O cache é apenas request-scoped; não compartilha contexto entre usuários/igrejas.
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
        "role, onboarding_completed_at, churches!inner(id, name, slug), profiles!inner(full_name, avatar_url, onboarding_completed)"
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("churches.slug", churchSlug)
      .maybeSingle();

    // Usuário master: opera em QUALQUER igreja, mesmo sem ser membro dela.
    if (!data) {
      const { data: isMaster } = await supabase.rpc("is_platform_admin");
      if (isMaster) {
        const [{ data: church }, { data: profile }] = await Promise.all([
          supabase
            .from("churches")
            .select("id, name, slug")
            .eq("slug", churchSlug)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("full_name, avatar_url, onboarding_completed")
            .eq("id", user.id)
            .single(),
        ]);
        if (!church) notFound();

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
          ministryMemberships: [],
          isCoord: true,
          isManager: true,
          isLeader: true,
          isGuardian: false,
          guardianOnly: false,
          isMaster: true,
        };
      }

      const { data: guardian } = await supabase
        .from("guardians")
        .select("church_id, churches!inner(id, name, slug)")
        .eq("user_id", user.id)
        .eq("churches.slug", churchSlug)
        .limit(1)
        .maybeSingle();

      if (guardian) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, onboarding_completed")
          .eq("id", user.id)
          .single();

        return {
          userId: user.id,
          church: guardian.churches as unknown as TenantContext["church"],
          role: "member",
          profile: (profile ?? {
            full_name: "",
            avatar_url: null,
            onboarding_completed: true,
          }) as TenantContext["profile"],
          ministryRoles: [],
          ministryMemberships: [],
          isCoord: false,
          isManager: false,
          isLeader: false,
          isGuardian: true,
          guardianOnly: true,
          isMaster: false,
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

    const [{ data: memberships }, { data: guardian }] = await Promise.all([
      supabase
        .from("ministry_members")
        .select("role, ministries(id, name, slug, module_key)")
        .eq("church_id", church.id)
        .eq("user_id", user.id)
        .eq("active", true),
      supabase
        .from("guardians")
        .select("id")
        .eq("church_id", church.id)
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle(),
    ]);

    // Mantém a mesma semântica anterior: os papéis vêm diretamente de
    // ministry_members e não dependem do join com ministries.
    const ministryRoles = (memberships ?? []).map(
      (membership) => membership.role as MinistryRole
    );
    const ministryMemberships: TenantMinistryMembership[] = (memberships ?? []).flatMap(
      (membership) => {
        const ministry = membership.ministries as unknown as {
          id: string;
          name: string;
          slug: string;
          module_key: "generic" | "worship" | "kids";
        } | null;
        if (!ministry) return [];
        return [{
          id: ministry.id,
          name: ministry.name,
          slug: ministry.slug,
          module_key: ministry.module_key,
          role: membership.role as MinistryRole,
        }];
      }
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
      ministryMemberships,
      isCoord,
      isManager,
      isLeader,
      isGuardian: !!guardian,
      guardianOnly: false,
      isMaster: false,
    };
  }
);
