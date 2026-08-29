create table if not exists public.campuses (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (church_id, name),
  unique (church_id, id)
);

alter table public.campuses enable row level security;

drop policy if exists campuses_select on public.campuses;
create policy campuses_select
on public.campuses
for select
using (public.is_church_member(church_id));

drop policy if exists campuses_manage on public.campuses;
create policy campuses_manage
on public.campuses
for all
using (public.is_church_coord(church_id))
with check (public.is_church_coord(church_id));

alter table public.events
  add column if not exists campus_id uuid,
  add column if not exists service_period text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_service_period_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_service_period_check
      check (service_period is null or service_period in ('manha', 'tarde', 'noite'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_campus_same_church_fkey'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_campus_same_church_fkey
      foreign key (church_id, campus_id)
      references public.campuses(church_id, id);
  end if;
end $$;

create index if not exists campuses_church_active_idx
  on public.campuses(church_id, active, sort_order, name);

create index if not exists events_campus_starts_idx
  on public.events(church_id, campus_id, starts_at);
