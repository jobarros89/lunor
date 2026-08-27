create or replace function public.resolve_assignment_substitution(
  p_assignment_id uuid,
  p_replacement_user_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_assignment public.assignments%rowtype;
  v_event public.events%rowtype;
  v_new_assignment_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  select * into v_assignment
  from public.assignments
  where id = p_assignment_id;

  if v_assignment.id is null then
    raise exception 'assignment not found';
  end if;

  if not public.is_church_leader(v_assignment.church_id) then
    raise exception 'leader required';
  end if;

  if v_assignment.status <> 'substituicao_solicitada' then
    raise exception 'substitution not requested';
  end if;

  if p_replacement_user_id = v_assignment.user_id then
    raise exception 'replacement must be another user';
  end if;

  if not exists (
    select 1
    from public.ministry_members mm
    where mm.church_id = v_assignment.church_id
      and mm.ministry_id = v_assignment.ministry_id
      and mm.user_id = p_replacement_user_id
      and mm.active
  ) then
    raise exception 'replacement is not active in ministry';
  end if;

  select * into v_event
  from public.events
  where id = v_assignment.event_id
    and church_id = v_assignment.church_id;

  if exists (
    select 1
    from public.unavailability u
    where u.church_id = v_assignment.church_id
      and u.user_id = p_replacement_user_id
      and v_event.starts_at::date between u.start_date and u.end_date
  ) then
    raise exception 'replacement unavailable';
  end if;

  if exists (
    select 1
    from public.assignments a
    where a.event_id = v_assignment.event_id
      and a.user_id = p_replacement_user_id
      and a.status <> 'substituido'
  ) then
    raise exception 'replacement already assigned to event';
  end if;

  insert into public.assignments (
    church_id,
    event_id,
    user_id,
    role_name,
    arrival_time,
    items_to_bring,
    leader_id,
    notes,
    ministry_id,
    status
  ) values (
    v_assignment.church_id,
    v_assignment.event_id,
    p_replacement_user_id,
    v_assignment.role_name,
    v_assignment.arrival_time,
    v_assignment.items_to_bring,
    v_user_id,
    v_assignment.notes,
    v_assignment.ministry_id,
    'convidado'
  ) returning id into v_new_assignment_id;

  update public.assignments
  set status = 'substituido', updated_at = now()
  where id = v_assignment.id;

  update public.substitution_requests
  set status = 'atendida',
      resolved_by = v_user_id,
      replacement_user_id = p_replacement_user_id,
      resolved_at = now()
  where assignment_id = v_assignment.id
    and status = 'aberta';

  return v_new_assignment_id;
end;
$$;

revoke all on function public.resolve_assignment_substitution(uuid, uuid) from public, anon;
grant execute on function public.resolve_assignment_substitution(uuid, uuid) to authenticated;

comment on function public.resolve_assignment_substitution(uuid, uuid)
  is 'Resolve uma substituição de escala de forma atômica, validando equipe, disponibilidade e conflito no evento.';
