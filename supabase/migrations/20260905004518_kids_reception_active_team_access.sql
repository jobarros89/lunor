create or replace function public.can_operate_kids_reception(
  p_church uuid,
  p_ministry uuid,
  p_session uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.is_active_ministry_member(p_church, p_ministry)
    and exists (
      select 1
      from public.kids_reception_sessions r
      where r.id = p_session
        and r.church_id = p_church
        and r.ministry_id = p_ministry
        and r.closed_at is null
    );
$$;

create or replace function public.current_kids_reception(
  p_church uuid,
  p_ministry uuid
)
returns table(
  session_id uuid,
  title text,
  event_id uuid,
  event_title text,
  opened_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.title, r.event_id, e.title, r.opened_at
  from public.kids_reception_sessions r
  left join public.events e on e.id = r.event_id
  where r.church_id = p_church
    and r.ministry_id = p_ministry
    and r.closed_at is null
    and public.is_active_ministry_member(p_church, p_ministry)
  order by r.opened_at desc
  limit 1;
$$;

revoke all on function public.can_operate_kids_reception(uuid, uuid, uuid) from public;
revoke all on function public.current_kids_reception(uuid, uuid) from public;
grant execute on function public.can_operate_kids_reception(uuid, uuid, uuid) to authenticated;
grant execute on function public.current_kids_reception(uuid, uuid) to authenticated;