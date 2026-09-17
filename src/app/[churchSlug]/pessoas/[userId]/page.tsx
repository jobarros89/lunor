import { notFound, redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SkillManager } from "@/components/pessoas/skill-manager";
import { MinistryManager } from "@/components/pessoas/ministry-manager";
import { ChurchRoleToggle } from "@/components/pessoas/church-role-toggle";
import { UnavailabilityManager } from "@/components/pessoas/unavailability-manager";
import { DIAS_SEMANA, PERIODOS } from "@/lib/briefing";

function formatPeriodo(inicio: string, fim: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  return inicio === fim ? fmt(inicio) : `${fmt(inicio)} — ${fmt(fim)}`;
}

export default async function PessoaDetailPage({
  params,
}: {
  params: Promise<{ churchSlug: string; userId: string }>;
}) {
  const { churchSlug, userId } = await params;
  const tenant = await getTenant(churchSlug);
  if (!tenant.isLeader && tenant.userId !== userId) {
    redirect(`/${churchSlug}/perfil`);
  }

  const supabase = await createClient();
  const [
    { data: member },
    { data: briefing },
    { data: memberSkills },
    { data: allSkills },
    { data: ministries },
    { data: memberships },
    { data: unavailability },
    { data: interests },
  ] = await Promise.all([
    supabase
      .from("church_members")
      .select(
        "role, profiles!inner(full_name, avatar_url, profession, phone, availability, created_at)"
      )
      .eq("church_id", tenant.church.id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("briefing_responses")
      .select("summary, answers, created_at")
      .eq("church_id", tenant.church.id)
      .eq("user_id", userId)
      .order("form_version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("member_skills")
      .select("skill_id, source, approved_by, skills!inner(name)")
      .eq("church_id", tenant.church.id)
      .eq("user_id", userId),
    supabase
      .from("skills")
      .select("id, name")
      .eq("church_id", tenant.church.id)
      .order("name"),
    supabase
      .from("ministries")
      .select("id, name")
      .eq("church_id", tenant.church.id)
      .order("name"),
    supabase
      .from("ministry_members")
      .select("ministry_id, role")
      .eq("church_id", tenant.church.id)
      .eq("user_id", userId)
      .eq("active", true),
    supabase
      .from("unavailability")
      .select("id, start_date, end_date, reason")
      .eq("church_id", tenant.church.id)
      .eq("user_id", userId)
      .gte("end_date", new Date().toISOString().slice(0, 10))
      .order("start_date"),
    supabase
      .from("member_interests")
      .select("skill_id, skills!inner(name)")
      .eq("church_id", tenant.church.id)
      .eq("user_id", userId),
  ]);

  if (!member) notFound();
  const profile = member.profiles as unknown as {
    full_name: string;
    avatar_url: string | null;
    profession: string | null;
    phone: string | null;
    availability: {
      dias?: string[];
      periodos?: string[];
      tempoDisponivel?: string;
    };
  };

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const dias = (profile.availability?.dias ?? [])
    .map((d) => DIAS_SEMANA.find((x) => x.key === d)?.label ?? d)
    .join(", ");
  const periodos = (profile.availability?.periodos ?? [])
    .map((p) => PERIODOS.find((x) => x.key === p)?.label ?? p)
    .join(", ");

  const skills = (memberSkills ?? []).map((ms) => ({
    skill_id: ms.skill_id,
    source: ms.source as "experience" | "training" | "both",
    approved_by: ms.approved_by,
    skill_name: (ms.skills as unknown as { name: string }).name,
  }));

  const isSelf = tenant.userId === userId;
  const interesses = (interests ?? []).map(
    (i) => (i.skills as unknown as { name: string }).name
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="page-title ">
            {profile.full_name}
          </h1>
          <div className="mt-1 flex flex-wrap gap-1">
            {member.role === "admin" && (
              <Badge className="rounded-full">Admin</Badge>
            )}
            {profile.profession && (
              <Badge variant="secondary" className="rounded-full">
                {profile.profession}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {briefing?.summary && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Resumo do perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {briefing.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {(dias || periodos) && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Disponibilidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            {dias && <p>Dias: {dias}</p>}
            {periodos && <p>Períodos: {periodos}</p>}
            {profile.availability?.tempoDisponivel && (
              <p>Tempo: {profile.availability.tempoDisponivel}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Aptidões</CardTitle>
        </CardHeader>
        <CardContent>
          <SkillManager
            churchSlug={churchSlug}
            churchId={tenant.church.id}
            userId={userId}
            memberSkills={skills}
            allSkills={allSkills ?? []}
            canManage={tenant.isManager}
          />
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Interesses</CardTitle>
          <p className="text-sm text-muted-foreground">
            Onde tem vontade de servir
          </p>
        </CardHeader>
        <CardContent>
          {interesses.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {interesses.map((nome) => (
                <Badge key={nome} variant="secondary" className="rounded-full">
                  {nome}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum interesse informado ainda.
            </p>
          )}
        </CardContent>
      </Card>

      {(isSelf || tenant.isLeader) && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Quando não posso servir</CardTitle>
            {isSelf && (
              <p className="text-sm text-muted-foreground">
                O líder vê isto ao montar a escala
              </p>
            )}
          </CardHeader>
          <CardContent>
            {isSelf ? (
              <UnavailabilityManager
                churchSlug={churchSlug}
                churchId={tenant.church.id}
                periodos={unavailability ?? []}
              />
            ) : (unavailability ?? []).length > 0 ? (
              <div className="space-y-2">
                {(unavailability ?? []).map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border px-4 py-2.5 text-sm"
                  >
                    {formatPeriodo(p.start_date, p.end_date)}
                    {p.reason && (
                      <span className="text-muted-foreground"> · {p.reason}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sem indisponibilidade marcada.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Ministérios</CardTitle>
        </CardHeader>
        <CardContent>
          <MinistryManager
            churchSlug={churchSlug}
            churchId={tenant.church.id}
            userId={userId}
            ministries={ministries ?? []}
            memberships={memberships ?? []}
            canManage={tenant.isManager}
          />
        </CardContent>
      </Card>

      {tenant.role === "admin" && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Papel na igreja</CardTitle>
          </CardHeader>
          <CardContent>
            <ChurchRoleToggle
              churchSlug={churchSlug}
              churchId={tenant.church.id}
              userId={userId}
              currentRole={member.role as "admin" | "coordenador" | "member"}
              isSelf={tenant.userId === userId}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
