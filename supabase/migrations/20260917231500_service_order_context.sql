-- Enrich the service order with optional clock, team and responsible assignment.
-- Existing items keep their sequential timing when scheduled_offset_minutes is null.

alter table public.service_items
  add column if not exists scheduled_offset_minutes integer
    check (scheduled_offset_minutes between 0 and 2880),
  add column if not exists ministry_id uuid references public.ministries(id) on delete set null,
  add column if not exists responsible_assignment_id uuid references public.assignments(id) on delete set null;

create index if not exists idx_service_items_ministry
  on public.service_items (ministry_id)
  where ministry_id is not null;

create index if not exists idx_service_items_responsible_assignment
  on public.service_items (responsible_assignment_id)
  where responsible_assignment_id is not null;

create or replace function public.enforce_service_item_context()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_assignment_ministry uuid;
begin
  if new.ministry_id is not null and not exists (
    select 1
    from public.event_ministries linked
    where linked.church_id = new.church_id
      and linked.event_id = new.event_id
      and linked.ministry_id = new.ministry_id
  ) then
    raise exception 'time deve estar vinculado ao evento';
  end if;

  if new.responsible_assignment_id is not null then
    select assignment.ministry_id
      into v_assignment_ministry
    from public.assignments assignment
    where assignment.id = new.responsible_assignment_id
      and assignment.church_id = new.church_id
      and assignment.event_id = new.event_id;

    if not found then
      raise exception 'responsável deve estar escalado neste evento';
    end if;

    if new.ministry_id is not null
      and v_assignment_ministry is not null
      and v_assignment_ministry <> new.ministry_id
    then
      raise exception 'responsável pertence a outro time do evento';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists service_items_context_guard on public.service_items;
create trigger service_items_context_guard
  before insert or update on public.service_items
  for each row execute function public.enforce_service_item_context();

-- Keep service-order management aligned with the scoped event permissions.
drop policy if exists service_items_write on public.service_items;
create policy service_items_write on public.service_items
  for all
  to authenticated
  using (
    public.is_church_coord(church_id)
    or exists (
      select 1
      from public.events event
      where event.id = service_items.event_id
        and event.church_id = service_items.church_id
        and (
          (
            event.ministry_id is not null
            and public.has_ministry_permission(
              event.ministry_id,
              array['gerente', 'lider']::public.ministry_role[],
              event.campus_id
            )
          )
          or exists (
            select 1
            from public.event_ministries linked
            where linked.event_id = event.id
              and public.has_ministry_permission(
                linked.ministry_id,
                array['gerente', 'lider']::public.ministry_role[],
                event.campus_id
              )
          )
        )
    )
  )
  with check (
    public.is_church_coord(church_id)
    or exists (
      select 1
      from public.events event
      where event.id = service_items.event_id
        and event.church_id = service_items.church_id
        and (
          (
            event.ministry_id is not null
            and public.has_ministry_permission(
              event.ministry_id,
              array['gerente', 'lider']::public.ministry_role[],
              event.campus_id
            )
          )
          or exists (
            select 1
            from public.event_ministries linked
            where linked.event_id = event.id
              and public.has_ministry_permission(
                linked.ministry_id,
                array['gerente', 'lider']::public.ministry_role[],
                event.campus_id
              )
          )
        )
    )
  );
