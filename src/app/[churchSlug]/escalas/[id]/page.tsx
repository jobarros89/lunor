import { notFound } from "next/navigation";
import { CalendarDays, Clock3, MapPin, Users } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { type SetlistItem, type Song } from "@/lib/louvor";
import { getLouvorMinistry } from "@/lib/louvor-server";
import { SetlistCard } from "@/components/louvor/setlist-card";
import { AddToSetlist } from "@/components/louvor/add-to-setlist";
import { getActiveMinistry } from "@/lib/ministry";
import { createClient } from "@/lib/supabase/server";
import {
  ASSIGNMENT_STATUS_BADGE,
  ASSIGNMENT_STATUS_LABELS,
  formatEventDate,
  formatEventTime,
} from "@/lib/escalas";
import { Badge } from "@/components/ui/badge";
import { LoadError } from "@/components/shell/load-error";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AssignmentManager,
  type AssignmentRow,
} from "@/components/escalas/assignment-manager";
import { MyAssignmentCard } from "@/components/escalas/my-assignment-card";
import {
  ServiceOrderCard,
  type ServiceItem,
} from "@/components/escalas/service-order-card";

export default async function EventoDetailPage({
  params,
}: {
  params: Promise<{ churchSlug: string; id: string }>;
}) {
  const { churchSlug, id } = await params;
  const tenant = await getTenant(churchSlug);
  const { active } = await getActiveMinistry(churchSlug);
  const canManage = active?.canManage ?? false;
  // sem setor ativo (caso raro): não escala nada
  const activeMinistryId = active?.id ?? "00000000-0000-0000-0000-000000000000";

  const supabase = await createClient();
  const [
    { data: event, error: eventError },
    { data: assignments, error: assignmentsError },
    { data: serviceItems, error: serviceItemsError },
  ] = await Promise.all([
    supabase
      .from("events")
      .select("*, event_types(name), departments(name)")
      .eq("id", id)
      .eq("church_id", tenant.church.id)
      .maybeSingle(),
    // escala do SETOR ativo neste evento (a RLS já isola; filtramos p/ consistência)
    supabase
      .from("assignments")
      .select(
        "id, user_id, role_name, status, arrival_time, items_to_bring, profiles!assignments_user_id_fkey(full_name), leader:profiles!assignments_leader_id_fkey(full_name)"
      )
      .eq("church_id", tenant.church.id)
      .eq("event_id", id)
      .eq("ministry_id", activeMinistryId)
      .order("created_at"),
    supabase
      .from("service_items")
      .select("id, type, title, notes, duration_minutes, position")
      .eq("church_id", tenant.church.id)
      .eq("event_id", id)
      .order("position"),
  ]);

  if (eventError) console.error("evento:", eventError);
  if (!event) notFound();

  // Repertório: a RLS decide o que aparece. Em rascunho volta vazio para quem
  // não é do louvor, então não é preciso checar o status aqui.
  const louvor = await getLouvorMinistry(tenant.church.id);
  const podeEditarRepertorio =
    !!louvor &&
    (tenant.isCoord ||
      (await supabase
        .from("ministry_members")
        .select("id")
        .eq("ministry_id", louvor.id)
        .eq("user_id", tenant.userId)
        .eq("active", true)
        .in("role", ["gerente", "lider"])
        .maybeSingle()
      ).data !== null);

  const { data: setlist, error: setlistError } = await supabase
    .from("setlist_items")
    .select(
      "id, position, key_override, notes, songs(id, title, artist, default_key, bpm, lyrics, link, active)"
    )
    .eq("church_id", tenant.church.id)
    .eq("event_id", id)
    .order("position");
  const itensRepertorio = (setlist ?? []) as unknown as SetlistItem[];

  // O acervo e o histórico só interessam a quem monta a sequência.
  let acervo: (Song & { ultimaVez: string | null })[] = [];
  let acervoError = false;
  if (podeEditarRepertorio) {
    const [
      { data: songs, error: songsError },
      { data: historico, error: historicoError },
    ] = await Promise.all([
      supabase
        .from("songs")
        .select("id, title, artist, default_key, bpm, lyrics, link, active")
        .eq("church_id", tenant.church.id)
        .eq("active", true)
        .order("title"),
      // "cantada há quanto tempo": derivado dos repertórios passados
      supabase
        .from("setlist_items")
        .select("song_id, events!inner(starts_at)")
        .eq("church_id", tenant.church.id)
        .lte("events.starts_at", new Date().toISOString()),
    ]);
    acervoError = !!songsError || !!historicoError;
    if (songsError) console.error("acervo do louvor:", songsError);
    if (historicoError) console.error("historico do louvor:", historicoError);
    const ultima = new Map<string, string>();
    for (const h of historico ?? []) {
      const quando = (h.events as unknown as { starts_at: string }).starts_at;
      const atual = ultima.get(h.song_id);
      if (!atual || quando > atual) ultima.set(h.song_id, quando);
    }
    acervo = (songs ?? []).map((s) => ({
      ...s,
      ultimaVez: ultima.get(s.id) ?? null,
    }));
  }

  // vínculos de equipamento SÓ deste evento (antes puxava todos da igreja)
  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: links } = assignmentIds.length
    ? await supabase
        .from("assignment_equipments")
        .select("assignment_id, equipments!inner(id, name)")
        .eq("church_id", tenant.church.id)
        .in("assignment_id", assignmentIds)
    : { data: [] as { assignment_id: string; equipments: unknown }[] };
  const type = event.event_types as unknown as { name: string } | null;
  const dept = event.departments as unknown as { name: string } | null;

  const equipByAssignment = new Map<string, { id: string; name: string }[]>();
  for (const l of links ?? []) {
    const eq = l.equipments as unknown as { id: string; name: string };
    equipByAssignment.set(l.assignment_id, [
      ...(equipByAssignment.get(l.assignment_id) ?? []),
      eq,
    ]);
  }

  const rows: AssignmentRow[] = (assignments ?? []).map((a) => ({
    id: a.id,
    user_id: a.user_id,
    full_name:
      (a.profiles as unknown as { full_name: string })?.full_name ?? "—",
    role_name: a.role_name,
    status: a.status,
    equipments: equipByAssignment.get(a.id) ?? [],
  }));

  const mine = (assignments ?? []).find((a) => a.user_id === tenant.userId);

  let members: {
    user_id: string;
    full_name: string;
    cargaMes: number;
    indisponivel: boolean;
    aptidoes: string[];
    interesses: string[];
  }[] = [];
  let equipments: { id: string; name: string }[] = [];
  if (canManage) {
    // janela do mês do evento (para a "carga do mês") e o dia do evento
    const dt = new Date(event.starts_at);
    const mesIni = new Date(dt.getFullYear(), dt.getMonth(), 1).toISOString();
    const mesFim = new Date(dt.getFullYear(), dt.getMonth() + 1, 1).toISOString();
    const eventoDia = (event.starts_at as string).slice(0, 10);
    const cid = tenant.church.id;

    const [
      { data: m },
      { data: eq },
      { data: cargas },
      { data: indisp },
      { data: apts },
      { data: ints },
    ] = await Promise.all([
      supabase
        .from("ministry_members")
        .select("user_id, profiles!inner(full_name)")
        .eq("church_id", cid)
        .eq("ministry_id", activeMinistryId)
        .eq("active", true),
      // equipamentos do setor ativo + os compartilhados da igreja (ministry_id nulo)
      supabase
        .from("equipments")
        .select("id, name")
        .eq("church_id", cid)
        .or(`ministry_id.eq.${activeMinistryId},ministry_id.is.null`)
        .in("status", ["disponivel", "em_uso"])
        .order("name"),
      supabase
        .from("assignments")
        .select("user_id, events!inner(starts_at)")
        .eq("church_id", cid)
        .gte("events.starts_at", mesIni)
        .lt("events.starts_at", mesFim),
      supabase
        .from("unavailability")
        .select("user_id")
        .eq("church_id", cid)
        .lte("start_date", eventoDia)
        .gte("end_date", eventoDia),
      supabase
        .from("member_skills")
        .select("user_id, skills!inner(name)")
        .eq("church_id", cid)
        .not("approved_by", "is", null),
      supabase
        .from("member_interests")
        .select("user_id, skills!inner(name)")
        .eq("church_id", cid),
    ]);

    const cargaBy = new Map<string, number>();
    for (const a of cargas ?? [])
      cargaBy.set(a.user_id, (cargaBy.get(a.user_id) ?? 0) + 1);
    const indispSet = new Set((indisp ?? []).map((u) => u.user_id));
    const skillsBy = new Map<string, string[]>();
    for (const s of apts ?? []) {
      const nome = (s.skills as unknown as { name: string }).name;
      skillsBy.set(s.user_id, [...(skillsBy.get(s.user_id) ?? []), nome]);
    }
    const intBy = new Map<string, string[]>();
    for (const i of ints ?? []) {
      const nome = (i.skills as unknown as { name: string }).name;
      intBy.set(i.user_id, [...(intBy.get(i.user_id) ?? []), nome]);
    }

    members = (m ?? []).map((x) => ({
      user_id: x.user_id,
      full_name: (x.profiles as unknown as { full_name: string }).full_name,
      cargaMes: cargaBy.get(x.user_id) ?? 0,
      indisponivel: indispSet.has(x.user_id),
      aptidoes: skillsBy.get(x.user_id) ?? [],
      interesses: intBy.get(x.user_id) ?? [],
    }));
    equipments = eq ?? [];
  }

  // Visão consolidada da igreja: o coordenador/pastor vê as escalas dos OUTROS
  // setores neste mesmo culto (a RLS já libera; aqui só consultamos).
  let outrosSetores: {
    ministry: string;
    rows: { name: string; role: string; status: string }[];
  }[] = [];
  if (tenant.isCoord) {
    const { data: others } = await supabase
      .from("assignments")
      .select(
        "role_name, status, ministries!inner(name), profiles!assignments_user_id_fkey(full_name)"
      )
      .eq("church_id", tenant.church.id)
      .eq("event_id", id)
      .neq("ministry_id", activeMinistryId)
      .order("created_at");
    const byMinistry = new Map<string, { name: string; role: string; status: string }[]>();
    for (const a of others ?? []) {
      const min = (a.ministries as unknown as { name: string }).name;
      byMinistry.set(min, [
        ...(byMinistry.get(min) ?? []),
        {
          name:
            (a.profiles as unknown as { full_name: string } | null)?.full_name ??
            "—",
          role: a.role_name,
          status: a.status,
        },
      ]);
    }
    outrosSetores = [...byMinistry.entries()]
      .map(([ministry, rows]) => ({ ministry, rows }))
      .sort((a, b) => a.ministry.localeCompare(b.ministry, "pt-BR"));
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {type?.name ?? "Evento"}
          </Badge>
          {dept?.name && (
            <Badge variant="outline" className="rounded-full">
              {dept.name}
            </Badge>
          )}
          <Badge
            className={`rounded-full border-0 ${
              event.setlist_status === "publicado"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
            }`}
          >
            Repertório {event.setlist_status === "publicado" ? "publicado" : "em rascunho"}
          </Badge>
        </div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          {event.title}
        </h1>
      </header>

      <Card className="rounded-3xl">
        <CardContent className="grid gap-4 py-5 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Data
              </p>
              <p className="mt-0.5 font-medium">{formatEventDate(event.starts_at)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Horário
              </p>
              <p className="mt-0.5 font-medium">
                {formatEventTime(event.starts_at)}
                {event.ends_at ? ` – ${formatEventTime(event.ends_at)}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Local / campus
              </p>
              {event.location ? (
                event.map_url ? (
                  <a
                    href={event.map_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 block truncate font-medium underline underline-offset-4"
                  >
                    {event.location}
                  </a>
                ) : (
                  <p className="mt-0.5 truncate font-medium">{event.location}</p>
                )
              ) : (
                <p className="mt-0.5 text-sm text-muted-foreground">Não informado</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="repertorio-title">
        <h2 id="repertorio-title" className="px-1 text-lg font-semibold tracking-tight">
          Repertório
        </h2>
        {setlistError ? (
          <LoadError oQue="o repertório" />
        ) : (
          <>
            <SetlistCard
              churchSlug={churchSlug}
              churchId={tenant.church.id}
              eventId={id}
              itens={itensRepertorio}
              publicado={event.setlist_status === "publicado"}
              publicadoEm={event.setlist_published_at}
              podeEditar={podeEditarRepertorio}
            />

            {podeEditarRepertorio && acervoError && (
              <LoadError oQue="o acervo de músicas" />
            )}

            {podeEditarRepertorio && !acervoError && (
              <Card className="rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-base">Escolher músicas</CardTitle>
                  <CardDescription>
                    Do acervo da igreja, na ordem em que vão ser cantadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AddToSetlist
                    churchSlug={churchSlug}
                    churchId={tenant.church.id}
                    eventId={id}
                    acervo={acervo}
                    jaEscolhidas={itensRepertorio.map((i) => i.songs.id)}
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="ordem-culto-title">
        <h2
          id="ordem-culto-title"
          className="px-1 text-lg font-semibold tracking-tight"
        >
          Ordem do Culto
        </h2>
        {serviceItemsError ? (
          <LoadError oQue="a ordem do culto" />
        ) : (
          <ServiceOrderCard
            churchSlug={churchSlug}
            churchId={tenant.church.id}
            eventId={id}
            startsAt={event.starts_at}
            items={(serviceItems ?? []) as ServiceItem[]}
            canManage={canManage}
          />
        )}
      </section>

      <section className="space-y-3" aria-labelledby="time-title">
        <div className="flex items-center gap-2 px-1">
          <Users className="size-5" />
          <h2 id="time-title" className="text-lg font-semibold tracking-tight">
            Time do culto
          </h2>
          {active?.name && (
            <span className="text-sm text-muted-foreground">· {active.name}</span>
          )}
        </div>

        {mine && (
          <MyAssignmentCard
            churchSlug={churchSlug}
            churchId={tenant.church.id}
            eventId={id}
            assignmentId={mine.id}
            roleName={mine.role_name}
            status={mine.status}
            arrivalTime={mine.arrival_time}
            itemsToBring={mine.items_to_bring}
            equipments={(equipByAssignment.get(mine.id) ?? []).map((e) => e.name)}
            leaderName={
              (mine.leader as unknown as { full_name: string } | null)?.full_name ?? null
            }
          />
        )}

        {assignmentsError ? (
          <LoadError oQue="a equipe escalada" />
        ) : (
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="text-base">Equipe escalada ({rows.length})</CardTitle>
              <CardDescription>Funções e confirmações deste culto</CardDescription>
            </CardHeader>
            <CardContent>
              {canManage ? (
                <AssignmentManager
                  churchSlug={churchSlug}
                  churchId={tenant.church.id}
                  ministryId={activeMinistryId}
                  eventId={id}
                  assignments={rows}
                  members={members}
                  equipments={equipments}
                />
              ) : (
                <div className="space-y-2">
                  {rows.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{a.full_name}</p>
                        <p className="truncate text-sm text-muted-foreground">{a.role_name}</p>
                      </div>
                      <Badge
                        className={`shrink-0 rounded-full border-0 ${ASSIGNMENT_STATUS_BADGE[a.status]}`}
                      >
                        {ASSIGNMENT_STATUS_LABELS[a.status]}
                      </Badge>
                    </div>
                  ))}
                  {rows.length === 0 && (
                    <p className="text-sm text-muted-foreground">Ninguém escalado ainda.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {(event.description || event.script) && (
        <section className="space-y-3" aria-labelledby="informacoes-title">
          <h2 id="informacoes-title" className="px-1 text-lg font-semibold tracking-tight">
            Informações do culto
          </h2>
          {event.description && (
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle className="text-base">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {event.description}
                </p>
              </CardContent>
            </Card>
          )}
          {event.script && (
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle className="text-base">Roteiro do culto</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {event.script}
                </p>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {outrosSetores.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Outros setores neste culto</CardTitle>
            <CardDescription>
              Visão da igreja — quem serve nos demais setores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {outrosSetores.map((s) => (
              <div key={s.ministry} className="space-y-2">
                <p className="text-sm font-semibold">
                  {s.ministry}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {s.rows.length}
                  </span>
                </p>
                {s.rows.map((r, i) => (
                  <div
                    key={`${s.ministry}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-2xl border px-4 py-2.5 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{r.name}</span>{" "}
                      <span className="text-muted-foreground">· {r.role}</span>
                    </span>
                    <Badge
                      className={`shrink-0 rounded-full border-0 ${ASSIGNMENT_STATUS_BADGE[r.status]}`}
                    >
                      {ASSIGNMENT_STATUS_LABELS[r.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
