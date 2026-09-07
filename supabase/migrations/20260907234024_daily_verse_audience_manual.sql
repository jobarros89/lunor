-- Versículo do dia: público por vínculo com a igreja e envio manual independente.
--
-- Regras:
-- 1. O cron continua limitado a uma execução por igreja/dia por versiculo_registrar.
-- 2. versiculo_alvos não elimina mais igrejas que já enviaram hoje; isso permite
--    que o fluxo manual reutilize os mesmos alvos e ignore apenas a reserva diária.
-- 3. O público é todo usuário vinculado à igreja (membro ativo ou responsável
--    Kids) que possua ao menos uma inscrição Web Push válida.
-- 4. Responsáveis Kids podem registrar a própria inscrição Push mesmo sem
--    church_members, pois o vínculo em guardians também identifica a igreja.

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
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is null or not exists (
    select 1 from cron_secret where secret = p_secret
  ) then
    raise exception 'não autorizado';
  end if;

  return query
  with igrejas as (
    select
      c.id,
      c.slug,
      coalesce(
        nullif(c.settings #>> '{notifications,daily_verse_version}', ''),
        'blt'
      ) as version,
      nullif(c.settings #>> '{notifications,daily_verse_theme}', '') as fixed_theme,
      coalesce(
        (
          select array_agg(d.reference order by d.sent_on desc)
          from daily_verse_sends d
          where d.church_id = c.id
            and d.sent_on > (now() at time zone 'America/Sao_Paulo')::date - 30
        ),
        '{}'::text[]
      ) as recent_references
    from churches c
    where coalesce(
      (c.settings #>> '{notifications,daily_verse_enabled}')::boolean,
      false
    )
  ),
  usuarios_igreja as (
    select cm.church_id, cm.user_id
    from church_members cm
    where cm.status = 'active'

    union

    select g.church_id, g.user_id
    from guardians g
    where g.user_id is not null
  )
  select distinct
    i.id,
    i.slug,
    i.version,
    i.fixed_theme,
    i.recent_references,
    ps.user_id,
    ps.endpoint,
    ps.p256dh,
    ps.auth
  from igrejas i
  join usuarios_igreja ui
    on ui.church_id = i.id
  join push_subscriptions ps
    on ps.user_id = ui.user_id;
end;
$$;

revoke all on function public.versiculo_alvos(text) from public;
grant execute on function public.versiculo_alvos(text) to anon, authenticated;

-- Permite que um responsável Kids vinculado em guardians registre Push para
-- a igreja mesmo que ele não seja um church_member tradicional.
drop policy if exists "push_subs_self_write" on public.push_subscriptions;

create policy "push_subs_self_write"
  on public.push_subscriptions
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      is_church_member(church_id)
      or exists (
        select 1
        from public.guardians g
        where g.church_id = push_subscriptions.church_id
          and g.user_id = auth.uid()
      )
    )
  );
