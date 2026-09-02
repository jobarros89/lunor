-- Responsável recebe somente o contexto operacional atual, sem acesso à agenda da igreja.

drop policy if exists events_guardian_select on public.events;

create or replace function public.guardian_current_kids_event(
  p_church uuid,
  p_ministry uuid
)
returns table(id uuid, title text, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.title, e.starts_at, e.ends_at
  from public.events e
  where e.church_id = p_church
    and public.is_event_operational(e.id)
    and exists (
      select 1
      from public.guardians g
      where g.church_id = p_church
        and g.ministry_id = p_ministry
        and g.user_id = auth.uid()
    )
  order by e.starts_at
  limit 1;
$$;

revoke all on function public.guardian_current_kids_event(uuid, uuid) from public, anon;
grant execute on function public.guardian_current_kids_event(uuid, uuid) to authenticated;
