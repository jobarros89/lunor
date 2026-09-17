-- Event-level responsibilities reuse assignments without creating artificial ministries.
-- Team assignments remain the default and keep their existing behavior.

alter table public.assignments
  add column if not exists assignment_scope text not null default 'team'
  check (assignment_scope in ('team', 'event'));

alter table public.assignments
  drop constraint if exists assignments_event_scope_shape;
alter table public.assignments
  add constraint assignments_event_scope_shape check (
    assignment_scope = 'team'
    or (
      assignment_scope = 'event'
      and ministry_id is null
      and department_id is null
      and function_id is null
    )
  );

create index if not exists idx_assignments_event_responsibilities
  on public.assignments (event_id, created_at)
  where assignment_scope = 'event';

-- Preserve the legacy fallback only for team assignments. Intentional event
-- responsibilities must remain independent from ministries.
create or replace function public.assignment_default_ministry()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assignment_scope = 'team' and new.ministry_id is null then
    new.ministry_id := coalesce(
      (select event.ministry_id from public.events event where event.id = new.event_id),
      (
        select ministry.id
        from public.ministries ministry
        where ministry.church_id = new.church_id
        order by (ministry.slug = 'midia') desc, ministry.created_at asc
        limit 1
      )
    );
  end if;
  return new;
end;
$$;

create or replace function public.enforce_assignment_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1
    from public.events event
    where event.id = new.event_id
      and event.church_id = new.church_id
  ) then
    raise exception 'evento e responsabilidade devem pertencer à mesma igreja';
  end if;

  if not exists (
    select 1
    from public.church_members membership
    where membership.church_id = new.church_id
      and membership.user_id = new.user_id
      and membership.status = 'active'
  ) then
    raise exception 'responsável deve ser membro ativo da igreja';
  end if;

  if new.assignment_scope = 'event' and (
    new.ministry_id is not null
    or new.department_id is not null
    or new.function_id is not null
  ) then
    raise exception 'responsabilidade do evento não pertence a ministério, time ou função de time';
  end if;

  return new;
end;
$$;

drop trigger if exists assignments_scope_guard on public.assignments;
create trigger assignments_scope_guard
  before insert or update on public.assignments
  for each row execute function public.enforce_assignment_scope();

drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
  for select using (
    user_id = auth.uid()
    or public.is_church_coord(church_id)
    or (
      assignment_scope = 'event'
      and public.is_church_member(church_id)
    )
    or (
      assignment_scope = 'team'
      and public.is_ministry_member_at_event(ministry_id, event_id)
    )
  );

drop policy if exists assignments_manage on public.assignments;
create policy assignments_manage on public.assignments
  for all using (
    (
      assignment_scope = 'event'
      and public.is_church_coord(church_id)
    )
    or (
      assignment_scope = 'team'
      and public.can_manage_ministry_event(ministry_id, event_id)
    )
  )
  with check (
    (
      assignment_scope = 'event'
      and public.is_church_coord(church_id)
    )
    or (
      assignment_scope = 'team'
      and public.can_manage_ministry_event(ministry_id, event_id)
    )
  );

create or replace function public.guard_assignment_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (auth.jwt() ->> 'role') = 'service_role'
    or (
      new.assignment_scope = 'event'
      and public.is_church_coord(new.church_id)
    )
    or (
      new.assignment_scope = 'team'
      and public.can_manage_ministry_event(new.ministry_id, new.event_id)
    )
  then
    return new;
  end if;

  if new.user_id <> auth.uid() or old.user_id <> auth.uid() then
    raise exception 'not_allowed';
  end if;
  if to_jsonb(new) - 'status' - 'updated_at'
    is distinct from
    to_jsonb(old) - 'status' - 'updated_at'
  then
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
