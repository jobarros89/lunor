import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";

/**
 * Portabilidade (LGPD): o titular baixa os PRÓPRIOS dados.
 *
 * As consultas rodam com a sessão do usuário, então a RLS já limita ao que é
 * dele — a exportação herda a parede em vez de contorná-la.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ churchSlug: string }> }
) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const supabase = await createClient();
  const uid = tenant.userId;

  const [perfil, vinculos, setores, aptidoes, interesses, indisponibilidade, escalas, avaliacoes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("church_members").select("church_id, role, status, joined_at").eq("user_id", uid),
      supabase
        .from("ministry_members")
        .select("role, active, joined_at, ministries!inner(name)")
        .eq("user_id", uid),
      supabase.from("member_skills").select("source, approved_at, skills!inner(name)").eq("user_id", uid),
      supabase.from("member_interests").select("created_at, skills!inner(name)").eq("user_id", uid),
      supabase.from("unavailability").select("start_date, end_date, reason").eq("user_id", uid),
      supabase
        .from("assignments")
        .select("role_name, status, created_at, events!inner(title, starts_at)")
        .eq("user_id", uid),
      supabase
        .from("evaluations")
        .select(
          "pontualidade, organizacao, conhecimento, comunicacao, trabalho_equipe, comprometimento, notes, created_at"
        )
        .eq("user_id", uid),
    ]);

  const dados = {
    exportado_em: new Date().toISOString(),
    tipo: "dados pessoais do titular",
    igreja: tenant.church.name,
    perfil: perfil.data ?? null,
    vinculos_igreja: vinculos.data ?? [],
    setores: setores.data ?? [],
    aptidoes: aptidoes.data ?? [],
    interesses: interesses.data ?? [],
    indisponibilidade: indisponibilidade.data ?? [],
    escalas: escalas.data ?? [],
    avaliacoes_recebidas: avaliacoes.data ?? [],
  };

  const nome = `lunor-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
