-- Separate church membership, ministry participation, operational function and
-- administrative permission. Existing leader/manager roles are migrated for compatibility.

create table public.ministry_admin_permissions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete cascade,
  role public.ministry_role not null check (role in ('gerente', 'lider')),
  source text not null default 'explicit' check (source in ('explicit', 'legacy')),
  created_at timestamptz not null default now()
);

create unique index ministry_admin_permissions_global_unique
  on public.ministry_admin_permissions(ministry_id, user_id)
  where campus_id is null;
create unique index ministry_admin_permissions_campus_unique
  on public.ministry_admin_permissions(ministry_id, user_id, campus_id)
  where campus_id is not null;
create index ministry_admin_permissions_user_idx
  on public.ministry_admin_permissions(church_id, user_id);
create index ministry_admin_permissions_scope_idx
  on public.ministry_admin_permissions(ministry_id, campus_id, role);

create table public.ministry_member_campuses (
  church_id uuid not null references public.churches(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  campus_id uuid not null references public.campuses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ministry_id, user_id, campus_id),
  foreign key (ministry_id, user_id)
    references public.ministry_members(ministry_id, user_id) on delete cascade
);

create table public.ministry_member_functions (
  church_id uuid not null references public.churches(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  function_id uuid not null references public.team_functions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ministry_id, user_id, function_id),
  foreign key (ministry_id, user_id)
    references public.ministry_members(ministry_id, user_id) on delete cascade
);

create or replace function public.enforce_ministry_permission_scope()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_church uuid;
begin
  select church_id into v_church from ministries where id = new.ministry_id;
  if v_church is null or v_church <> new.church_id then
    raise exception 'permissão e ministério devem pertencer à mesma igreja';
  end if;
  if new.campus_id is not null and not exists (
    select 1 from campuses where id = new.campus_id and church_id = new.church_id
  ) then
    raise exception 'campus deve pertencer à mesma igreja';
  end if;
  if not exists (
    select 1 from ministry_members
    where ministry_id = new.ministry_id and user_id = new.user_id and active
  ) then
    raise exception 'permissão administrativa exige participação ativa no ministério';
  end if;
  return new;
end;
$$;

create trigger trg_ministry_permission_scope
  before insert or update on public.ministry_admin_permissions
  for each row execute function public.enforce_ministry_permission_scope();

create or replace function public.enforce_member_campus_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from ministries where id = new.ministry_id and church_id = new.church_id
  ) or not exists (
    select 1 from campuses where id = new.campus_id and church_id = new.church_id
  ) then
    raise exception 'participação, ministério e campus devem pertencer à mesma igreja';
  end if;
  return new;
end;
$$;

create trigger trg_member_campus_scope
  before insert or update on public.ministry_member_campuses
  for each row execute function public.enforce_member_campus_scope();

create or replace function public.enforce_member_function_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from team_functions tf
    where tf.id = new.function_id
      and tf.church_id = new.church_id
      and tf.ministry_id = new.ministry_id
      and tf.active
  ) then
    raise exception 'função operacional fora do ministério ou inativa';
  end if;
  return new;
end;
$$;

create trigger trg_member_function_scope
  before insert or update on public.ministry_member_functions
  for each row execute function public.enforce_member_function_scope();

-- Existing leaders/managers become explicit global permissions.
insert into public.ministry_admin_permissions (
  church_id, ministry_id, user_id, campus_id, role, source
)
select church_id, ministry_id, user_id, null, role, 'legacy'
from public.ministry_members
where active and role in ('gerente', 'lider')
on conflict do nothing;

-- Compatibility for older clients that still write ministry_members.role.
create or replace function public.sync_legacy_ministry_permission()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from ministry_admin_permissions
    where ministry_id = old.ministry_id and user_id = old.user_id;
    return old;
  end if;

  if new.active and new.role in ('gerente', 'lider') then
    insert into ministry_admin_permissions (
      church_id, ministry_id, user_id, campus_id, role, source
    ) values (
      new.church_id, new.ministry_id, new.user_id, null, new.role, 'legacy'
    )
    on conflict (ministry_id, user_id) where campus_id is null
    do update set role = excluded.role, source = 'legacy';
  else
    delete from ministry_admin_permissions
    where ministry_id = new.ministry_id
      and user_id = new.user_id
      and campus_id is null
      and source = 'legacy';
  end if;
  return new;
end;
$$;

create trigger trg_sync_legacy_ministry_permission
  after insert or update of role, active on public.ministry_members
  for each row execute function public.sync_legacy_ministry_permission();

create trigger trg_delete_ministry_permissions
  after delete on public.ministry_members
  for each row execute function public.sync_legacy_ministry_permission();

-- Central authorization helper. A null campus only accepts a global grant.
create or replace function public.has_ministry_permission(
  p_ministry uuid,
  p_roles public.ministry_role[],
  p_campus uuid default null
)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_church_coord((select church_id from ministries where id = p_ministry))
    or exists (
      select 1
      from ministry_admin_permissions permission
      join ministry_members membership
        on membership.ministry_id = permission.ministry_id
       and membership.user_id = permission.user_id
       and membership.active
      where permission.ministry_id = p_ministry
        and permission.user_id = auth.uid()
        and permission.role = any(p_roles)
        and (
          permission.campus_id is null
          or (p_campus is not null and permission.campus_id = p_campus)
        )
    );
$$;

-- Keep the old helper signature, but administrative roles now come from the
-- permission table. Volunteer/instructor checks remain participation checks.
create or replace function public.has_ministry_role(
  p_ministry uuid,
  p_roles public.ministry_role[]
)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_ministry_permission(p_ministry, p_roles, null)
    or exists (
      select 1 from ministry_members membership
      where membership.ministry_id = p_ministry
        and membership.user_id = auth.uid()
        and membership.active
        and membership.role = any(p_roles)
        and membership.role in ('instrutor', 'voluntario')
    );
$$;

create or replace function public.can_manage_ministry_event(
  p_ministry uuid,
  p_event uuid
)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from events event
    join ministries ministry on ministry.id = p_ministry
    where event.id = p_event
      and event.church_id = ministry.church_id
      and public.has_ministry_permission(
        p_ministry,
        array['gerente', 'lider']::public.ministry_role[],
        event.campus_id
      )
  );
$$;

create or replace function public.is_ministry_member_at_event(
  p_ministry uuid,
  p_event uuid
)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from ministry_members membership
    join events event on event.id = p_event
    where membership.ministry_id = p_ministry
      and membership.user_id = auth.uid()
      and membership.active
      and (
        event.campus_id is null
        or not exists (
          select 1 from ministry_member_campuses restriction
          where restriction.ministry_id = membership.ministry_id
            and restriction.user_id = membership.user_id
        )
        or exists (
          select 1 from ministry_member_campuses allowed
          where allowed.ministry_id = membership.ministry_id
            and allowed.user_id = membership.user_id
            and allowed.campus_id = event.campus_id
        )
      )
  );
$$;

-- Church-wide helpers no longer promote a ministry permission to the whole
-- church. Scoped operations must use has_ministry_permission/can_manage_ministry_event.
create or replace function public.is_church_manager(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_church_coord(p_church);
$$;

create or replace function public.is_church_leader(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_church_coord(p_church);
$$;

alter table public.ministry_admin_permissions enable row level security;
alter table public.ministry_member_campuses enable row level security;
alter table public.ministry_member_functions enable row level security;

create policy ministry_admin_permissions_select on public.ministry_admin_permissions
  for select using (public.is_church_member(church_id));
create policy ministry_admin_permissions_manage on public.ministry_admin_permissions
  for all using (public.is_church_coord(church_id))
  with check (public.is_church_coord(church_id));

create policy ministry_member_campuses_select on public.ministry_member_campuses
  for select using (
    user_id = auth.uid()
    or public.is_church_coord(church_id)
    or public.has_ministry_permission(
      ministry_id, array['gerente', 'lider']::public.ministry_role[], campus_id
    )
  );
create policy ministry_member_campuses_manage on public.ministry_member_campuses
  for all using (
    public.is_church_coord(church_id)
    or public.has_ministry_permission(
      ministry_id, array['gerente', 'lider']::public.ministry_role[], campus_id
    )
  ) with check (
    public.is_church_coord(church_id)
    or public.has_ministry_permission(
      ministry_id, array['gerente', 'lider']::public.ministry_role[], campus_id
    )
  );

create policy ministry_member_functions_select on public.ministry_member_functions
  for select using (
    user_id = auth.uid()
    or public.is_church_coord(church_id)
    or public.has_ministry_permission(
      ministry_id, array['gerente', 'lider']::public.ministry_role[], null
    )
  );
create policy ministry_member_functions_manage on public.ministry_member_functions
  for all using (
    public.is_church_coord(church_id)
    or public.has_ministry_permission(
      ministry_id, array['gerente', 'lider']::public.ministry_role[], null
    )
  ) with check (
    public.is_church_coord(church_id)
    or public.has_ministry_permission(
      ministry_id, array['gerente', 'lider']::public.ministry_role[], null
    )
  );

grant select, insert, update, delete on
  public.ministry_admin_permissions,
  public.ministry_member_campuses,
  public.ministry_member_functions
to authenticated;

-- Ministry participation can only be managed by church coordinators or a
-- global manager of that ministry. Campus leaders cannot grant wider access.
drop policy if exists ministry_members_manage on public.ministry_members;
create policy ministry_members_manage on public.ministry_members
  for all using (
    public.is_church_coord(church_id)
    or public.has_ministry_permission(
      ministry_id, array['gerente']::public.ministry_role[], null
    )
  ) with check (
    public.is_church_coord(church_id)
    or public.has_ministry_permission(
      ministry_id, array['gerente']::public.ministry_role[], null
    )
  );

-- Events: leaders are limited to their ministry and the event campus.
drop policy if exists events_manage on public.events;
create policy events_manage on public.events
  for all using (
    public.is_church_coord(church_id)
    or (
      ministry_id is not null
      and public.has_ministry_permission(
        ministry_id,
        array['gerente', 'lider']::public.ministry_role[],
        campus_id
      )
    )
  ) with check (
    public.is_church_coord(church_id)
    or (
      ministry_id is not null
      and public.has_ministry_permission(
        ministry_id,
        array['gerente', 'lider']::public.ministry_role[],
        campus_id
      )
    )
  );

drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
  for select using (
    user_id = auth.uid()
    or public.is_church_coord(church_id)
    or public.is_ministry_member_at_event(ministry_id, event_id)
  );

drop policy if exists assignments_manage on public.assignments;
create policy assignments_manage on public.assignments
  for all using (public.can_manage_ministry_event(ministry_id, event_id))
  with check (public.can_manage_ministry_event(ministry_id, event_id));

create or replace function public.guard_assignment_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.can_manage_ministry_event(new.ministry_id, new.event_id) then
    return new;
  end if;
  if new.user_id <> auth.uid() or old.user_id <> auth.uid() then
    raise exception 'not_allowed';
  end if;
  if to_jsonb(new) - 'status' - 'updated_at' is distinct from to_jsonb(old) - 'status' - 'updated_at' then
    raise exception 'only_status_change_allowed';
  end if;
  if not (
    (old.status = 'convidado' and new.status in ('confirmado', 'substituicao_solicitada'))
    or (old.status = 'confirmado' and new.status = 'substituicao_solicitada')
    or (old.status = 'substituicao_solicitada' and new.status = 'confirmado')
  ) then
    raise exception 'invalid_status_transition';
  end if;
  return new;
end;
$$;

drop policy if exists event_ministries_insert on public.event_ministries;
create policy event_ministries_insert on public.event_ministries
  for insert with check (public.can_manage_ministry_event(ministry_id, event_id));
drop policy if exists event_ministries_delete on public.event_ministries;
create policy event_ministries_delete on public.event_ministries
  for delete using (public.can_manage_ministry_event(ministry_id, event_id));

drop policy if exists event_ministry_windows_insert on public.event_ministry_windows;
create policy event_ministry_windows_insert on public.event_ministry_windows
  for insert with check (public.can_manage_ministry_event(ministry_id, event_id));
drop policy if exists event_ministry_windows_update on public.event_ministry_windows;
create policy event_ministry_windows_update on public.event_ministry_windows
  for update using (public.can_manage_ministry_event(ministry_id, event_id))
  with check (public.can_manage_ministry_event(ministry_id, event_id));
drop policy if exists event_ministry_windows_delete on public.event_ministry_windows;
create policy event_ministry_windows_delete on public.event_ministry_windows
  for delete using (public.can_manage_ministry_event(ministry_id, event_id));

-- Availability reads honor both ministry and campus scope.
drop policy if exists member_availability_select on public.member_availability;
create policy member_availability_select on public.member_availability
  for select using (
    user_id = auth.uid()
    or public.is_church_coord(church_id)
    or public.can_manage_ministry_event(ministry_id, event_id)
  );

drop policy if exists member_availability_calendar_select on public.member_availability_calendar;
create policy member_availability_calendar_select on public.member_availability_calendar
  for select using (
    user_id = auth.uid()
    or public.is_church_coord(church_id)
    or (
      ministry_id is not null
      and public.has_ministry_permission(
        ministry_id, array['gerente', 'lider']::public.ministry_role[], campus_id
      )
    )
    or (
      ministry_id is null and exists (
        select 1 from ministry_members target
        where target.church_id = member_availability_calendar.church_id
          and target.user_id = member_availability_calendar.user_id
          and target.active
          and public.has_ministry_permission(
            target.ministry_id,
            array['gerente', 'lider']::public.ministry_role[],
            member_availability_calendar.campus_id
          )
      )
    )
  );

drop policy if exists member_availability_recurring_select on public.member_availability_recurring;
create policy member_availability_recurring_select on public.member_availability_recurring
  for select using (
    user_id = auth.uid()
    or public.is_church_coord(church_id)
    or (
      ministry_id is not null
      and public.has_ministry_permission(
        ministry_id, array['gerente', 'lider']::public.ministry_role[], campus_id
      )
    )
    or (
      ministry_id is null and exists (
        select 1 from ministry_members target
        where target.church_id = member_availability_recurring.church_id
          and target.user_id = member_availability_recurring.user_id
          and target.active
          and public.has_ministry_permission(
            target.ministry_id,
            array['gerente', 'lider']::public.ministry_role[],
            member_availability_recurring.campus_id
          )
      )
    )
  );

-- Availability requests can span events only when every selected event is in
-- the caller's campus scope.
create or replace function public.create_availability_request(
  p_church uuid,
  p_ministry uuid,
  p_title text,
  p_event_ids uuid[],
  p_respond_by timestamptz default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_request uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from ministries where id = p_ministry and church_id = p_church
  ) then raise exception 'invalid_ministry'; end if;
  if coalesce(array_length(p_event_ids, 1), 0) = 0 then
    raise exception 'events_required';
  end if;
  if exists (
    select 1
    from unnest(p_event_ids) selected(event_id)
    left join events event on event.id = selected.event_id
    where event.id is null
      or event.church_id <> p_church
      or not public.can_manage_ministry_event(p_ministry, event.id)
  ) then raise exception 'not_allowed_or_invalid_event'; end if;

  insert into availability_requests (
    church_id, ministry_id, title, respond_by, created_by
  ) values (
    p_church, p_ministry, trim(p_title), p_respond_by, auth.uid()
  ) returning id into v_request;

  insert into availability_request_events (
    request_id, event_id, church_id, ministry_id
  )
  select v_request, event_id, p_church, p_ministry
  from (select distinct unnest(p_event_ids) event_id) selected;
  return v_request;
end;
$$;


-- Related assignment resources inherit the assignment's ministry/campus scope.
drop policy if exists assignment_equipments_manage on public.assignment_equipments;
create policy assignment_equipments_manage on public.assignment_equipments
  for all using (
    exists (
      select 1 from assignments assignment
      where assignment.id = assignment_id
        and assignment.church_id = assignment_equipments.church_id
        and public.can_manage_ministry_event(
          assignment.ministry_id, assignment.event_id
        )
    )
  ) with check (
    exists (
      select 1 from assignments assignment
      where assignment.id = assignment_id
        and assignment.church_id = assignment_equipments.church_id
        and public.can_manage_ministry_event(
          assignment.ministry_id, assignment.event_id
        )
    )
  );

drop policy if exists substitution_select on public.substitution_requests;
create policy substitution_select on public.substitution_requests
  for select using (
    requested_by = auth.uid()
    or public.is_church_coord(church_id)
    or exists (
      select 1 from assignments assignment
      where assignment.id = assignment_id
        and public.can_manage_ministry_event(
          assignment.ministry_id, assignment.event_id
        )
    )
  );

drop policy if exists substitution_leader_update on public.substitution_requests;
create policy substitution_leader_update on public.substitution_requests
  for update using (
    public.is_church_coord(church_id)
    or exists (
      select 1 from assignments assignment
      where assignment.id = assignment_id
        and public.can_manage_ministry_event(
          assignment.ministry_id, assignment.event_id
        )
    )
  );

-- Event types are church-wide configuration, not a ministry permission.
drop policy if exists event_types_manage on public.event_types;
create policy event_types_manage on public.event_types
  for all using (public.is_church_coord(church_id))
  with check (public.is_church_coord(church_id));
