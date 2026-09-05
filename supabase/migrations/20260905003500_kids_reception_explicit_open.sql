-- Estado explícito de recepção Kids aberta.
-- Entrar na rota da sessão abre a recepção para as famílias; o estado também
-- expira automaticamente após o fim operacional do evento.

create table if not exists public.kids_reception_sessions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  opened_at timestamptz not null default now(),
  opened_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  unique (ministry_id, event_id)
);

create index if not exists kids_reception_sessions_open_idx
  on public.kids_reception_sessions (church_id, ministry_id, opened_at desc)
  where closed_at is null;

alter table public.kids_reception_sessions enable row level security;
revoke all on table public.kids_reception_sessions from anon, authenticated;

create or replace function public.is_kids_reception_open(
  p_church uuid,
  p_ministry uuid,
  p_event uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.kids_reception_sessions r
    join public.events e on e.id = r.event_id
    where r.church_id = p_church
      and r.ministry_id = p_ministry
      and r.event_id = p_event
      and r.closed_at is null
      and e.church_id = p_church
      and now() <= coalesce(e.ends_at, e.starts_at + interval '4 hours') + interval '60 minutes'
  );
$$;

create or replace function public.open_kids_reception(
  p_church uuid,
  p_ministry uuid,
  p_event uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not public.can_operate_kids(p_church, p_ministry, p_event) then
    raise exception 'not_allowed';
  end if;

  if not exists (
    select 1
    from public.events e
    where e.id = p_event
      and e.church_id = p_church
  ) or not exists (
    select 1
    from public.ministries m
    where m.id = p_ministry
      and m.church_id = p_church
  ) then
    raise exception 'invalid_reception_context';
  end if;

  update public.kids_reception_sessions
     set closed_at = now(),
         closed_by = auth.uid()
   where church_id = p_church
     and ministry_id = p_ministry
     and event_id <> p_event
     and closed_at is null;

  insert into public.kids_reception_sessions (
    church_id,
    ministry_id,
    event_id,
    opened_at,
    opened_by,
    closed_at,
    closed_by
  ) values (
    p_church,
    p_ministry,
    p_event,
    now(),
    auth.uid(),
    null,
    null
  )
  on conflict (ministry_id, event_id) do update
    set church_id = excluded.church_id,
        opened_at = excluded.opened_at,
        opened_by = excluded.opened_by,
        closed_at = null,
        closed_by = null;

  return true;
end;
$$;

create or replace function public.guardian_current_kids_event(
  p_church uuid,
  p_ministry uuid
)
returns table(
  id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.title, e.starts_at, e.ends_at
  from public.events e
  where e.church_id = p_church
    and (
      public.is_kids_reception_open(p_church, p_ministry, e.id)
      or public.is_event_operational(e.id)
    )
    and exists (
      select 1
      from public.guardians g
      where g.church_id = p_church
        and g.ministry_id = p_ministry
        and g.user_id = auth.uid()
    )
  order by
    case when public.is_kids_reception_open(p_church, p_ministry, e.id) then 0 else 1 end,
    e.starts_at
  limit 1;
$$;

create or replace function public.guardian_checkin_child(
  p_church uuid,
  p_ministry uuid,
  p_event uuid,
  p_child uuid,
  p_class uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checkin uuid;
  v_code text;
begin
  if auth.uid() is null or not public.is_guardian_of(p_child) then
    raise exception 'not_allowed';
  end if;

  if (
       not public.is_event_operational(p_event)
       and not public.is_kids_reception_open(p_church, p_ministry, p_event)
     )
     or not exists (
       select 1 from public.events e
       where e.id = p_event and e.church_id = p_church
     )
     or not exists (
       select 1 from public.children c
       where c.id = p_child
         and c.church_id = p_church
         and c.ministry_id = p_ministry
         and c.active
     ) then
    raise exception 'operation_not_available';
  end if;

  if exists (
    select 1 from public.child_checkins c
    where c.event_id = p_event
      and c.child_id = p_child
      and c.checked_out_at is null
  ) then
    raise exception 'already_checked_in';
  end if;

  for i in 1..20 loop
    v_code := (100 + floor(random() * 900))::integer::text;
    begin
      insert into public.child_checkins (
        church_id, ministry_id, event_id, class_id, child_id, code, checked_in_by
      ) values (
        p_church, p_ministry, p_event, p_class, p_child, v_code, auth.uid()
      ) returning id into v_checkin;
      return v_checkin;
    exception when unique_violation then
      null;
    end;
  end loop;

  raise exception 'code_generation_failed';
end;
$$;

revoke all on function public.is_kids_reception_open(uuid, uuid, uuid) from public;
revoke all on function public.open_kids_reception(uuid, uuid, uuid) from public;
revoke all on function public.guardian_current_kids_event(uuid, uuid) from public;
revoke all on function public.guardian_checkin_child(uuid, uuid, uuid, uuid, uuid) from public;

grant execute on function public.is_kids_reception_open(uuid, uuid, uuid) to authenticated;
grant execute on function public.open_kids_reception(uuid, uuid, uuid) to authenticated;
grant execute on function public.guardian_current_kids_event(uuid, uuid) to authenticated;
grant execute on function public.guardian_checkin_child(uuid, uuid, uuid, uuid, uuid) to authenticated;
