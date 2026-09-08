-- Contexto seguro para a página do Versículo do Dia.
-- Retorna somente configuração da igreja, referências bíblicas e tema.
-- Nenhum dado pessoal ou inscrição Push é exposto.

create or replace function public.daily_verse_context_for_member(p_church uuid)
returns table (
  enabled boolean,
  version text,
  fixed_theme text,
  recent_references text[],
  sent_theme text,
  sent_reference text,
  sent_on date
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not (
    public.is_church_member(p_church)
    or public.is_guardian_at_church(p_church)
    or public.is_platform_admin()
  ) then
    raise exception 'not_allowed';
  end if;

  return query
  select
    coalesce(
      (c.settings #>> '{notifications,daily_verse_enabled}')::boolean,
      false
    ) as enabled,
    coalesce(
      nullif(c.settings #>> '{notifications,daily_verse_version}', ''),
      'blt'
    ) as version,
    nullif(c.settings #>> '{notifications,daily_verse_theme}', '') as fixed_theme,
    coalesce(
      (
        select array_agg(d.reference order by d.sent_on desc)
        from public.daily_verse_sends d
        where d.church_id = c.id
          and d.sent_on > (now() at time zone 'America/Sao_Paulo')::date - 30
      ),
      '{}'::text[]
    ) as recent_references,
    today.theme as sent_theme,
    today.reference as sent_reference,
    today.sent_on
  from public.churches c
  left join lateral (
    select d.theme, d.reference, d.sent_on
    from public.daily_verse_sends d
    where d.church_id = c.id
      and d.sent_on = (now() at time zone 'America/Sao_Paulo')::date
    limit 1
  ) today on true
  where c.id = p_church;
end;
$$;

revoke all on function public.daily_verse_context_for_member(uuid) from public;
grant execute on function public.daily_verse_context_for_member(uuid) to authenticated;
