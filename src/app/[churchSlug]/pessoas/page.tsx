import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
        <p className="text-muted-foreground">
          {members?.length ?? 0} pessoas na igreja
          {tenant.role === "admin" && " · toque em uma pessoa para gerenciar permissões"}
        </p>
      </div>

      <div className="space-y-3">
        {membersError && <LoadError oQue="a equipe" />}
        {(members ?? []).map((m) => {
          const profile = m.profiles as unknown as {
            full_name: string;
            avatar_url: string | null;
            profession: string | null;
          };
          const initials = profile.full_name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
          const userRoles = rolesByUser.get(m.user_id) ?? [];
          const count = skillCount.get(m.user_id) ?? 0;

          return (
            <Link key={m.user_id} href={`/${churchSlug}/pessoas/${m.user_id}`} className="block">
              <Card className="rounded-3xl transition-colors hover:bg-accent/40">
                <CardContent className="flex items-center gap-4 py-4">
                  <Avatar className="size-12">
                    <AvatarImage src={profile.avatar_url ?? undefined} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{profile.full_name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {profile.profession || "—"}
                      {count > 0 && ` · ${count} aptidões`}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {CHURCH_ROLE_LABELS[m.role] && (
                      <Badge className="rounded-full">{CHURCH_ROLE_LABELS[m.role]}</Badge>
                    )}
                    {userRoles.map((r) => (
                      <Badge key={r} variant="secondary" className="rounded-full">
                        {ROLE_LABELS[r] ?? r}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
