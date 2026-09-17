import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { TeamDirectory } from "@/components/pessoas/team-directory";
import { LoadError } from "@/components/shell/load-error";

const ROLE_LABELS: Record<string, string> = {
  gerente: "Gerente",
  lider: "Líder",
  instrutor: "Instrutor",
  voluntario: "Voluntário",
};

const CHURCH_ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  coordenador: "Gestor",
};

export default async function PessoasPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  if (!tenant.isLeader) redirect(`/${churchSlug}/perfil`);

  const supabase = await createClient();
  const [
    { data: members, error: membersError },
    { data: roles },
    { data: skills },
  ] = await Promise.all([
    supabase
      .from("church_members")
      .select("user_id, role, profiles!inner(full_name, avatar_url, profession)")
      .eq("church_id", tenant.church.id)
      .eq("status", "active"),
    supabase
      .from("ministry_members")
      .select("user_id, role")
      .eq("church_id", tenant.church.id)
      .eq("active", true),
    supabase
      .from("member_skills")
      .select("user_id")
      .eq("church_id", tenant.church.id)
      .not("approved_by", "is", null),
  ]);
  if (membersError) console.error("pessoas:", membersError);

  const rolesByUser = new Map<string, string[]>();
  for (const r of roles ?? []) {
    const atuais = rolesByUser.get(r.user_id) ?? [];
    if (!atuais.includes(r.role)) rolesByUser.set(r.user_id, [...atuais, r.role]);
  }
  const skillCount = new Map<string, number>();
  for (const s of skills ?? []) {
    skillCount.set(s.user_id, (skillCount.get(s.user_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipe"
        description={
          tenant.role === "admin"
            ? "Encontre as pessoas da igreja e acesse sua ficha para gerenciar funções e permissões."
            : "Encontre as pessoas da igreja e consulte suas funções e aptidões."
        }
      />
      {membersError ? (
        <LoadError oQue="a equipe" />
      ) : (
        <TeamDirectory
          churchSlug={churchSlug}
          members={(members ?? []).map((member) => {
            const profile = member.profiles as unknown as {
              full_name: string;
              avatar_url: string | null;
              profession: string | null;
            };
            return {
              id: member.user_id,
              name: profile.full_name,
              avatarUrl: profile.avatar_url,
              profession: profile.profession,
              skillCount: skillCount.get(member.user_id) ?? 0,
              churchRole: CHURCH_ROLE_LABELS[member.role] ?? null,
              roles: (rolesByUser.get(member.user_id) ?? []).map(
                (role) => ROLE_LABELS[role] ?? role,
              ),
            };
          })}
        />
      )}
    </div>
  );
}
