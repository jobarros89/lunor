import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";

/**
 * Portabilidade da IGREJA (ela é a controladora dos dados).
 *
 * Roda com a sessão do coordenador: a RLS garante que só sai o que ele já
 * enxerga, e nada de outra igreja. O arquivo pode conter dados sensíveis de
 * menores — a tela avisa isso antes de baixar.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ churchSlug: string }> }
) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  if (!tenant.isCoord) redirect(`/${churchSlug}`);

  const supabase = await createClient();
  const cid = tenant.church.id;
  const emIgreja = <T extends string>(t: T) =>
    supabase.from(t).select("*").eq("church_id", cid);

  const [
    igreja,
    membros,
    ministerios,
    membrosSetor,
    departamentos,
    aptidoesCatalogo,
    aptidoes,
    interesses,
    indisponibilidade,
    eventos,
    escalas,
    equipamentos,
    manutencoes,
    avaliacoes,
    criancas,
    responsaveis,
    autorizacoes,
    presencas,
  ] = await Promise.all([
    supabase.from("churches").select("*").eq("id", cid).maybeSingle(),
    supabase.from("church_members").select("*, profiles!inner(full_name, phone, profession)").eq("church_id", cid),
    emIgreja("ministries"),
    emIgreja("ministry_members"),
    emIgreja("departments"),
    emIgreja("skills"),
    emIgreja("member_skills"),
    emIgreja("member_interests"),
    emIgreja("unavailability"),
    emIgreja("events"),
    emIgreja("assignments"),
    emIgreja("equipments"),
    emIgreja("maintenance_tickets"),
    emIgreja("evaluations"),
    emIgreja("children"),
    emIgreja("guardians"),
    emIgreja("child_guardians"),
    emIgreja("child_checkins"),
  ]);

  const dados = {
    exportado_em: new Date().toISOString(),
    tipo: "dados da igreja",
    aviso:
      "Contém dados pessoais e, possivelmente, dados sensíveis de menores. Guarde com cuidado e não compartilhe.",
    igreja: igreja.data ?? null,
    pessoas: membros.data ?? [],
    ministerios: ministerios.data ?? [],
    membros_por_setor: membrosSetor.data ?? [],
    departamentos: departamentos.data ?? [],
    catalogo_aptidoes: aptidoesCatalogo.data ?? [],
    aptidoes: aptidoes.data ?? [],
    interesses: interesses.data ?? [],
    indisponibilidade: indisponibilidade.data ?? [],
    eventos: eventos.data ?? [],
    escalas: escalas.data ?? [],
    equipamentos: equipamentos.data ?? [],
    manutencoes: manutencoes.data ?? [],
    avaliacoes: avaliacoes.data ?? [],
    infantil: {
      criancas: criancas.data ?? [],
      responsaveis: responsaveis.data ?? [],
      autorizacoes_retirada: autorizacoes.data ?? [],
      presencas: presencas.data ?? [],
    },
  };

  const nome = `lunor-${churchSlug}-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
