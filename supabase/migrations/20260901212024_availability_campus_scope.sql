-- Disponibilidade pode ser geral para a igreja/ministério ou específica por campus.
-- Registros existentes permanecem com campus_id nulo = todos os campus.

alter table public.member_availability_calendar
  add column if not exists campus_id uuid;

alter table public.member_availability_recurring
  add column if not exists campus_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'member_availability_calendar_campus_same_church_fkey'
      and conrelid = 'public.member_availability_calendar'::regclass
  ) then
    alter table public.member_availability_calendar
      add constraint member_availability_calendar_campus_same_church_fkey
      foreign key (church_id, campus_id)
      references public.campuses(church_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'member_availability_recurring_campus_same_church_fkey'
      and conrelid = 'public.member_availability_recurring'::regclass
  ) then
    alter table public.member_availability_recurring
      add constraint member_availability_recurring_campus_same_church_fkey
      foreign key (church_id, campus_id)
      references public.campuses(church_id, id);
  end if;
end $$;

drop index if exists public.idx_member_availability_calendar_general_unique;
drop index if exists public.idx_member_availability_calendar_ministry_unique;
drop index if exists public.idx_member_availability_calendar_lookup;

create unique index if not exists idx_member_availability_calendar_general_unique
  on public.member_availability_calendar (church_id, user_id, availability_date, period)
  where ministry_id is null and campus_id is null;

create unique index if not exists idx_member_availability_calendar_general_campus_unique
  on public.member_availability_calendar (church_id, user_id, campus_id, availability_date, period)
  where ministry_id is null and campus_id is not null;

create unique index if not exists idx_member_availability_calendar_ministry_unique
  on public.member_availability_calendar (ministry_id, user_id, availability_date, period)
  where ministry_id is not null and campus_id is null;

create unique index if not exists idx_member_availability_calendar_ministry_campus_unique
  on public.member_availability_calendar (ministry_id, user_id, campus_id, availability_date, period)
  where ministry_id is not null and campus_id is not null;

create index if not exists idx_member_availability_calendar_lookup
  on public.member_availability_calendar
  (church_id, ministry_id, campus_id, availability_date, status);

create index if not exists idx_member_availability_calendar_campus_fk
  on public.member_availability_calendar (church_id, campus_id)
  where campus_id is not null;

drop index if exists public.idx_member_availability_recurring_general_unique;
drop index if exists public.idx_member_availability_recurring_ministry_unique;
drop index if exists public.idx_member_availability_recurring_lookup;

create unique index if not exists idx_member_availability_recurring_general_unique
  on public.member_availability_recurring (church_id, user_id, weekday, period)
  where ministry_id is null and campus_id is null;

create unique index if not exists idx_member_availability_recurring_general_campus_unique
  on public.member_availability_recurring (church_id, user_id, campus_id, weekday, period)
  where ministry_id is null and campus_id is not null;

create unique index if not exists idx_member_availability_recurring_ministry_unique
  on public.member_availability_recurring (ministry_id, user_id, weekday, period)
  where ministry_id is not null and campus_id is null;

create unique index if not exists idx_member_availability_recurring_ministry_campus_unique
  on public.member_availability_recurring (ministry_id, user_id, campus_id, weekday, period)
  where ministry_id is not null and campus_id is not null;

create index if not exists idx_member_availability_recurring_lookup
  on public.member_availability_recurring
  (church_id, ministry_id, campus_id, weekday, status);

create index if not exists idx_member_availability_recurring_campus_fk
  on public.member_availability_recurring (church_id, campus_id)
  where campus_id is not null;
