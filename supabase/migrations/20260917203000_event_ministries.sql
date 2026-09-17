-- Explicitly link every ministry/team participating in an event.
create table public.event_ministries (
  church_id uuid not null references public.churches (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  ministry_id uuid not null references public.ministries (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, ministry_id)
);

create index idx_event_ministries_church on public.event_ministries (church_id);
create index idx_event_ministries_ministry on public.event_ministries (ministry_id);

create or replace function public.enforce_event_ministry_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_church uuid;
  v_ministry_church uuid;
begin
  select church_id into v_event_church
  from public.events where id = new.event_id;

  select church_id into v_ministry_church
  from public.ministries where id = new.ministry_id;

  if v_event_church is null or v_ministry_church is null then
    raise exception 'evento ou ministério inexistente';
  end if;
  if new.church_id <> v_event_church or new.church_id <> v_ministry_church then
    raise exception 'evento e ministério devem pertencer à mesma igreja';
  end if;
  return new;
end;
$$;

create trigger trg_event_ministry_scope
  before insert or update on public.event_ministries
  for each row execute function public.enforce_event_ministry_scope();

alter table public.event_ministries enable row level security;

create policy event_ministries_select on public.event_ministries
  for select using (public.is_church_member(church_id));

create policy event_ministries_insert on public.event_ministries
  for insert with check (
    public.is_church_coord(church_id)
    or public.has_ministry_role(
      ministry_id,
      array['gerente', 'lider']::public.ministry_role[]
    )
  );

create policy event_ministries_delete on public.event_ministries
  for delete using (
    public.is_church_coord(church_id)
    or public.has_ministry_role(
      ministry_id,
      array['gerente', 'lider']::public.ministry_role[]
    )
  );

grant select, insert, update, delete on public.event_ministries to authenticated;

-- Preserve existing single-ministry events and assignments.
insert into public.event_ministries (church_id, event_id, ministry_id)
select church_id, id, ministry_id
from public.events
where ministry_id is not null
on conflict (event_id, ministry_id) do nothing;

insert into public.event_ministries (church_id, event_id, ministry_id)
select distinct church_id, event_id, ministry_id
from public.assignments
where ministry_id is not null
on conflict (event_id, ministry_id) do nothing;

-- Any future assignment automatically makes its ministry visible in
-- "Times do culto", including assignments created by dedicated modules.
create or replace function public.sync_assignment_event_ministry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ministry_id is not null then
    insert into public.event_ministries (
      church_id, event_id, ministry_id, created_by
    )
    values (
      new.church_id, new.event_id, new.ministry_id, auth.uid()
    )
    on conflict (event_id, ministry_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_sync_assignment_event_ministry
  after insert or update of event_id, ministry_id on public.assignments
  for each row execute function public.sync_assignment_event_ministry();

-- Keep the compatibility ministry_id on newly created events represented too.
create or replace function public.sync_event_primary_ministry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ministry_id is not null then
    insert into public.event_ministries (
      church_id, event_id, ministry_id, created_by
    )
    values (
      new.church_id, new.id, new.ministry_id, new.created_by
    )
    on conflict (event_id, ministry_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_sync_event_primary_ministry
  after insert or update of ministry_id on public.events
  for each row execute function public.sync_event_primary_ministry();
