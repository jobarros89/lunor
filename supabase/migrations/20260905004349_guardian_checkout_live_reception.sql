create or replace function public.guardian_checkout_child(p_checkin uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.child_checkins%rowtype;
  v_guardian uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select c.* into v_row
  from public.child_checkins c
  where c.id = p_checkin
    and c.checked_out_at is null
  for update;

  if v_row.id is null then
    raise exception 'operation_not_available';
  end if;

  if v_row.reception_session_id is not null then
    if not exists (
      select 1
      from public.kids_reception_sessions r
      where r.id = v_row.reception_session_id
        and r.church_id = v_row.church_id
        and r.ministry_id = v_row.ministry_id
        and r.closed_at is null
    ) then
      raise exception 'operation_not_available';
    end if;
  elsif v_row.event_id is null or not public.is_event_operational(v_row.event_id) then
    raise exception 'operation_not_available';
  end if;

  select g.id into v_guardian
  from public.child_guardians cg
  join public.guardians g on g.id = cg.guardian_id
  where cg.child_id = v_row.child_id
    and cg.can_pickup
    and g.user_id = auth.uid()
  order by cg.is_primary desc, cg.created_at
  limit 1;

  if v_guardian is null then
    raise exception 'pickup_not_authorized';
  end if;

  update public.child_checkins
  set picked_up_by = v_guardian,
      checked_out_at = now(),
      checked_out_by = auth.uid()
  where id = v_row.id;

  return coalesce(v_row.reception_session_id, v_row.event_id);
end;
$$;

revoke all on function public.guardian_checkout_child(uuid) from public;
grant execute on function public.guardian_checkout_child(uuid) to authenticated;