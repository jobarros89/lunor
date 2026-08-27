-- Mantém os lembretes operacionais compatíveis com a RPC original.
--
-- O horário de 09:00 continua sendo responsabilidade do agendador. A função
-- não deve deixar de produzir lembretes apenas porque foi chamada em outro
-- horário (testes, retry manual ou recuperação de uma execução perdida).
-- A idempotência segue garantida por reminders_sent.

create or replace function public.lembretes_do_dia(p_secret text)
returns table (
  user_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  titulo text,
  corpo text,
  url text
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_agora timestamp;
  v_hoje date;
  v_amanha date;
  v_hora integer;
  v_dow integer;
begin
  if p_secret is null or not exists (select 1 from cron_secret where secret = p_secret) then
    raise exception 'não autorizado';
  end if;

  v_agora := now() at time zone 'America/Sao_Paulo';
  v_hoje := v_agora::date;
  v_amanha := v_hoje + 1;
  v_hora := extract(hour from v_agora)::integer;
  v_dow := extract(dow from v_agora)::integer;

  return query
  with eventos_amanha as (
    select e.id, e.title, e.starts_at, e.church_id, e.setlist_status,
           c.slug as church_slug
    from events e
    join churches c on c.id = e.church_id
    where ((e.starts_at at time zone 'America/Sao_Paulo')::date) = v_amanha
  ),

  vespera as (
    select a.user_id,
           'vespera'::text as kind,
           a.id as ref_id,
           'Você serve amanhã'::text as titulo,
           ev.title || ' · ' ||
             to_char(ev.starts_at at time zone 'America/Sao_Paulo', 'HH24:MI') ||
             ' · ' || a.role_name as corpo,
           '/' || ev.church_slug || '/escalas/' || ev.id as url
    from assignments a
    join eventos_amanha ev on ev.id = a.event_id
    where a.status in ('convidado', 'confirmado')
  ),

  pendentes as (
    select a.ministry_id, a.event_id, count(*) as qtd
    from assignments a
    join eventos_amanha ev on ev.id = a.event_id
    where a.status = 'convidado'
    group by a.ministry_id, a.event_id
  ),
  cobranca as (
    select mm.user_id,
           'confirmacao_pendente'::text as kind,
           p.event_id as ref_id,
           'Falta confirmação'::text as titulo,
           p.qtd || (case when p.qtd = 1 then ' pessoa não confirmou' else ' pessoas não confirmaram' end)
             || ' para amanhã.' as corpo,
           '/' || ev.church_slug || '/escalas/' || ev.id as url
    from pendentes p
    join eventos_amanha ev on ev.id = p.event_id
    join ministry_members mm on mm.ministry_id = p.ministry_id
     and mm.active and mm.role in ('gerente', 'lider')
  ),

  repertorio as (
    select mm.user_id,
           'repertorio_rascunho'::text as kind,
           ev.id as ref_id,
           'Repertório ainda não publicado'::text as titulo,
           ev.title || ' é amanhã e a equipe ainda não vê a sequência.' as corpo,
           '/' || ev.church_slug || '/escalas/' || ev.id as url
    from eventos_amanha ev
    join ministry_members mm
      on mm.ministry_id = public.louvor_ministry(ev.church_id)
     and mm.active and mm.role in ('gerente', 'lider')
    where ev.setlist_status = 'rascunho'
      and exists (select 1 from setlist_items si where si.event_id = ev.id)
  ),

  preparacao_sexta as (
    select a.user_id,
           'preparacao_sexta'::text as kind,
           a.id as ref_id,
           'Prepare o coração para servir'::text as titulo,
           coalesce(
             nullif(c.settings #>> '{notifications,friday_preparation_message}', ''),
             ev.title || ' · ' || a.role_name || '. Já separou um tempo para sua devocional? Revise também sua escala.'
           ) || ' ' || coalesce(
             nullif(c.settings #>> '{notifications,friday_preparation_verse}', ''),
             '“Servi ao Senhor com alegria.” — Sl 100:2'
           ) as corpo,
           '/' || c.slug || '/escalas/' || ev.id as url
    from assignments a
    join events ev on ev.id = a.event_id and ev.church_id = a.church_id
    join churches c on c.id = a.church_id
    where v_dow = 5
      and v_hora = 19
      and a.status in ('convidado', 'confirmado')
      and ((ev.starts_at at time zone 'America/Sao_Paulo')::date) between (v_hoje + 1) and (v_hoje + 2)
      and coalesce((c.settings #>> '{notifications,friday_preparation_enabled}')::boolean, true)
  ),

  todos as (
    select * from vespera
    union all select * from cobranca
    union all select * from repertorio
    union all select * from preparacao_sexta
  ),

  novos as (
    insert into reminders_sent (kind, ref_id, user_id)
    select t.kind, t.ref_id, t.user_id from todos t
    on conflict (kind, ref_id, user_id, sent_on) do nothing
    returning reminders_sent.kind, reminders_sent.ref_id, reminders_sent.user_id
  )
  select ps.user_id, ps.endpoint, ps.p256dh, ps.auth, t.titulo, t.corpo, t.url
  from novos n
  join todos t
    on t.kind = n.kind and t.ref_id = n.ref_id and t.user_id = n.user_id
  join push_subscriptions ps on ps.user_id = n.user_id;
end;
$$;

revoke all on function public.lembretes_do_dia(text) from public;
grant execute on function public.lembretes_do_dia(text) to anon, authenticated;
