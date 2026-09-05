-- Versículo diário: registro de rodízio por igreja.
--
-- Guardamos apenas a REFERÊNCIA (ex.: "Sl 100:2") e o tema, nunca o texto
-- bíblico. O texto é buscado na API no momento do envio, na tradução que a
-- igreja configurou em settings.notifications.daily_verse_version.
--
-- Motivo: as traduções modernas em português são obras protegidas das
-- sociedades bíblicas, e boa parte dos datasets públicos é licenciada como
-- não-comercial. Referência bíblica é citação, não obra — então o LUNOR
-- fica fora da questão de licenciamento de tradução.
--
-- Configuração por igreja (churches.settings -> notifications):
--   daily_verse_enabled  (boolean, default false — opt-in explícito)
--   daily_verse_version  (text, default 'blt')
--   daily_verse_theme    (text, tema fixo; se ausente, rotação automática)

create table public.daily_verse_sends (
  id         bigserial primary key,
  church_id  uuid not null references public.churches (id) on delete cascade,
  sent_on    date not null default (now() at time zone 'America/Sao_Paulo')::date,
  theme      text not null,
  reference  text not null,
  created_at timestamptz not null default now(),
  unique (church_id, sent_on)
);

create index idx_daily_verse_sends_rodizio
  on public.daily_verse_sends (church_id, sent_on desc);

alter table public.daily_verse_sends enable row level security;

-- Sem acesso direto pelo cliente: a tabela é escrita apenas pelo cron no
-- servidor, que usa service role e faz bypass de RLS. Nenhum dado pessoal
-- aqui — só referência e tema por igreja.
create policy "daily_verse_sends_sem_acesso_direto"
  on public.daily_verse_sends
  for all
  to public
  using (false);

-- ------------------------------------------------------------------
-- RPCs do cron
--
-- A rota /api/cron usa a chave anon de propósito (não service role), e
-- prova identidade com o CRON_SECRET. Seguimos exatamente o mesmo desenho
-- de lembretes_do_dia: SECURITY DEFINER + verificação do segredo, para que
-- comprometer o Worker não dê acesso irrestrito ao banco.
-- ------------------------------------------------------------------

-- Igrejas com versículo diário ligado que ainda não receberam hoje,
-- junto das inscrições de push e das referências recentes (rodízio).
create or replace function public.versiculo_alvos(p_secret text)
returns table (
  church_id uuid,
  church_slug text,
  version text,
  fixed_theme text,
  recent_references text[],
  user_id uuid,
  endpoint text,
  p256dh text,
  auth text
)
language plpgsql security definer set search_path = public as $$
declare
  v_hoje date;
begin
  if p_secret is null or not exists (select 1 from cron_secret where secret = p_secret) then
    raise exception 'não autorizado';
  end if;

  v_hoje := (now() at time zone 'America/Sao_Paulo')::date;

  return query
  with igrejas as (
    select c.id,
           c.slug,
           coalesce(nullif(c.settings #>> '{notifications,daily_verse_version}', ''), 'blt') as version,
           nullif(c.settings #>> '{notifications,daily_verse_theme}', '') as fixed_theme,
           coalesce(
             (select array_agg(d.reference)
                from daily_verse_sends d
               where d.church_id = c.id
                 and d.sent_on > v_hoje - 30),
             '{}'::text[]
           ) as recent_references
      from churches c
     where coalesce((c.settings #>> '{notifications,daily_verse_enabled}')::boolean, false)
       and not exists (
             select 1 from daily_verse_sends d
              where d.church_id = c.id and d.sent_on = v_hoje
           )
  )
  select i.id, i.slug, i.version, i.fixed_theme, i.recent_references,
         ps.user_id, ps.endpoint, ps.p256dh, ps.auth
    from igrejas i
    join push_subscriptions ps on ps.church_id = i.id;
end;
$$;

-- Reserva o dia antes do envio. Devolve true só para quem conseguiu
-- reservar — assim duas execuções do cron no mesmo dia não mandam duas
-- vezes, mesma filosofia do reminders_sent.
create or replace function public.versiculo_registrar(
  p_secret text,
  p_church_id uuid,
  p_theme text,
  p_reference text
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_linhas integer;
begin
  if p_secret is null or not exists (select 1 from cron_secret where secret = p_secret) then
    raise exception 'não autorizado';
  end if;

  insert into daily_verse_sends (church_id, theme, reference)
  values (p_church_id, p_theme, p_reference)
  on conflict (church_id, sent_on) do nothing;

  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

revoke all on function public.versiculo_alvos(text) from public;
revoke all on function public.versiculo_registrar(text, uuid, text, text) from public;
grant execute on function public.versiculo_alvos(text) to anon, authenticated;
grant execute on function public.versiculo_registrar(text, uuid, text, text) to anon, authenticated;
