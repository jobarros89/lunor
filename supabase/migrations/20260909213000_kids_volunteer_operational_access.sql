-- LUNOR Kids: voluntário ativo do ministério recebe acesso operacional do Kids.
-- Escopo: abrir/encerrar recepção e vincular/desvincular acesso familiar.
-- Configurações administrativas (turmas, impressão etc.) continuam restritas à liderança.

create or replace function public.open_kids_reception_session(
  p_church uuid,
  p_ministry uuid,
  p_title text,
  p_event uuid,
  p_campus uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.kids_reception_sessions%rowtype;
  v_id uuid;
  v_title text;
  v_event_campus uuid;
  v_campus uuid;
begin
  if auth.uid() is null
     or not public.is_active_ministry_member(p_church, p_ministry) then
    raise exception 'not_allowed';
  end if;

  if not exists (
    select 1 from public.ministries m
    where m.id = p_ministry and m.church_id = p_church
  ) then
    raise exception 'invalid_reception_context';
  end if;

  if p_event is not null then
    select e.campus_id into v_event_campus
    from public.events e
    where e.id = p_event and e.church_id = p_church;

    if not found then
      raise exception 'invalid_reception_context';
    end if;

    if v_event_campus is not null and p_campus is not null and v_event_campus <> p_campus then
      raise exception 'campus_mismatch';
    end if;
  end if;

  v_campus := coalesce(v_event_campus, p_campus);
  if v_campus is null then
    raise exception 'campus_required';
  end if;

  if not exists (
    select 1
    from public.campuses c
    where c.id = v_campus
      and c.church_id = p_church
      and c.active = true
  ) then
    raise exception 'invalid_campus';
  end if;

  select * into v_existing
  from public.kids_reception_sessions r
  where r.church_id = p_church
    and r.ministry_id = p_ministry
    and r.campus_id = v_campus
    and r.closed_at is null
  order by r.opened_at desc
  limit 1;

  if found then
    if p_event is not null and v_existing.event_id = p_event then
      return v_existing.id;
    end if;
    raise exception 'reception_already_open';
  end if;

  v_title := nullif(btrim(coalesce(p_title, '')), '');
  if v_title is null and p_event is not null then
    select e.title into v_title from public.events e where e.id = p_event;
  end if;
  v_title := coalesce(v_title, 'Recepção Kids');

  insert into public.kids_reception_sessions (
    church_id, ministry_id, event_id, campus_id, title, opened_at, opened_by
  ) values (
    p_church, p_ministry, p_event, v_campus, v_title, now(), auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

-- Compatibilidade para telas antigas ligadas a evento: o campus vem do culto.
create or replace function public.open_kids_reception_session(
  p_church uuid,
  p_ministry uuid,
  p_title text default 'Recepção Kids',
  p_event uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campus uuid;
begin
  if p_event is null then
    raise exception 'campus_required';
  end if;

  select e.campus_id into v_campus
  from public.events e
  where e.id = p_event and e.church_id = p_church;

  if not found then
    raise exception 'invalid_reception_context';
  end if;

  return public.open_kids_reception_session(
    p_church,
    p_ministry,
    p_title,
    p_event,
    v_campus
  );
end;
$$;

create or replace function public.close_kids_reception(
  p_church uuid,
  p_ministry uuid,
  p_session uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not public.is_active_ministry_member(p_church, p_ministry) then
    raise exception 'not_allowed';
  end if;

  if not exists (
    select 1
    from public.kids_reception_sessions r
    where r.id = p_session
      and r.church_id = p_church
      and r.ministry_id = p_ministry
      and r.closed_at is null
  ) then
    raise exception 'reception_not_open';
  end if;

  if exists (
    select 1
    from public.child_checkins c
    where c.reception_session_id = p_session
      and c.checked_out_at is null
  ) then
    raise exception 'children_still_present';
  end if;

  update public.kids_reception_sessions
  set closed_at = now(), closed_by = auth.uid()
  where id = p_session
    and church_id = p_church
    and ministry_id = p_ministry
    and closed_at is null;

  update public.child_pages
  set resolved_at = coalesce(resolved_at, now()),
      resolved_by = coalesce(resolved_by, auth.uid())
  where reception_session_id = p_session
    and resolved_at is null;

  return true;
end;
$$;

-- Vinculação manual de uma conta existente ao responsável, sem ampliar a policy
-- genérica de UPDATE em guardians. Somente integrante ativo do Kids pode usar.
create or replace function public.link_guardian_account(
  p_church uuid,
  p_ministry uuid,
  p_guardian uuid,
  p_user uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not public.is_active_ministry_member(p_church, p_ministry) then
    raise exception 'not_allowed';
  end if;

  if not exists (
    select 1
    from public.guardians g
    where g.id = p_guardian
      and g.church_id = p_church
      and g.ministry_id = p_ministry
  ) then
    raise exception 'guardian_not_found';
  end if;

  if not exists (
    select 1
    from public.church_members cm
    where cm.church_id = p_church
      and cm.user_id = p_user
      and cm.status = 'active'
  ) then
    raise exception 'target_user_not_active';
  end if;

  update public.guardians
  set user_id = p_user
  where id = p_guardian
    and church_id = p_church
    and ministry_id = p_ministry;

  return found;
end;
$$;

create or replace function public.unlink_guardian_account(
  p_church uuid,
  p_ministry uuid,
  p_guardian uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$;
begin
  return false;
end;
$$;
