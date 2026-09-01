-- ============================================================
-- LUNOR — disponibilidade binária + calendário independente
-- ============================================================

-- Respostas antigas "maybe" passam a ser "sem resposta".
delete from public.member_availability where status = 'maybe';

alter table public.member_availability
  drop constraint if exists member_availability_status_check;

alter table public.member_availability
  add constraint member_availability_status_check
  check (status in ('available', 'unavailable'));

-- Disponibilidade específica por data. ministry_id nulo = disponibilidade geral.
create table if not exists public.member_availability_calendar (
  id                uuid primary key default gen_random_uuid(),
  church_id         uuid not null references public.churches(id) on delete cascade,
  ministry_id       uuid references public.ministries(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  availability_date date not null,
  period            text not null default 'all_day'
                    check (period in ('all_day', 'morning', 'afternoon', 'evening')),
  status            text not null check (status in ('available', 'unavailable')),
  note              text check (note is null or char_length(note) <= 200),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists idx_member_availability_calendar_general_unique
  on public.member_availability_calendar (church_id, user_id, availability_date, period)
  where ministry_id is null;

create unique index if not exists idx_member_availability_calendar_ministry_unique
  on public.member_availability_calendar (ministry_id, user_id, availability_date, period)
  where ministry_id is not null;

create index if not exists idx_member_availability_calendar_lookup
  on public.member_availability_calendar (church_id, ministry_id, availability_date, status);

-- Padrão recorrente semanal. weekday: 0=domingo ... 6=sábado.
create table if not exists public.member_availability_recurring (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  ministry_id uuid references public.ministries(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  period      text not null default 'all_day'
              check (period in ('all_day', 'morning', 'afternoon', 'evening')),
  status      text not null check (status in ('available', 'unavailable')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists idx_member_availability_recurring_general_unique
  on public.member_availability_recurring (church_id, user_id, weekday, period)
  where ministry_id is null;

create unique index if not exists idx_member_availability_recurring_ministry_unique
  on public.member_availability_recurring (ministry_id, user_id, weekday, period)
  where ministry_id is not null;

create index if not exists idx_member_availability_recurring_lookup
  on public.member_availability_recurring (church_id, ministry_id, weekday, status);

create or replace function public.guard_member_availability_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ministry_id is not null and not exists (
    select 1 from public.ministries m
    where m.id = new.ministry_id and m.church_id = new.church_id
  ) then
    raise exception 'availability_scope_mismatch';
  end if;
  return new;
end;
$$;

create trigger member_availability_calendar_scope
  before insert or update on public.member_availability_calendar
  for each row execute function public.guard_member_availability_scope();

create trigger member_availability_recurring_scope
  before insert or update on public.member_availability_recurring
  for each row execute function public.guard_member_availability_scope();

create trigger member_availability_calendar_updated_at
  before update on public.member_availability_calendar
  for each row execute function public.set_updated_at();

create trigger member_availability_recurring_updated_at
  before update on public.member_availability_recurring
  for each row execute function public.set_updated_at();

alter table public.member_availability_calendar enable row level security;
alter table public.member_availability_recurring enable row level security;

create policy member_availability_calendar_select
  on public.member_availability_calendar
  for select using (
    user_id = auth.uid()
    or public.is_church_coord(church_id)
    or (
      ministry_id is not null
      and public.has_ministry_role(ministry_id, array['gerente', 'lider']::public.ministry_role[])
    )
  );

create policy member_availability_calendar_self_insert
  on public.member_availability_calendar
  for insert with check (
    user_id = auth.uid()
    and (
      (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

create policy member_availability_calendar_self_update
  on public.member_availability_calendar
  for update using (
    user_id = auth.uid()
    and (
      (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  ) with check (
    user_id = auth.uid()
    and (
      (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

create policy member_availability_calendar_self_delete
  on public.member_availability_calendar
  for delete using (
    user_id = auth.uid()
    and (
      (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

create policy member_availability_recurring_select
  on public.member_availability_recurring
  for select using (
    user_id = auth.uid()
    or public.is_church_coord(church_id)
    or (
      ministry_id is not null
      and public.has_ministry_role(ministry_id, array['gerente', 'lider']::public.ministry_role[])
    )
  );

create policy member_availability_recurring_self_insert
  on public.member_availability_recurring
  for insert with check (
    user_id = auth.uid()
    and (
      (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

create policy member_availability_recurring_self_update
  on public.member_availability_recurring
  for update using (
    user_id = auth.uid()
    and (
      (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  ) with check (
    user_id = auth.uid()
    and (
      (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

create policy member_availability_recurring_self_delete
  on public.member_availability_recurring
  for delete using (
    user_id = auth.uid()
    and (
      (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

create trigger audit_member_availability_calendar
  after insert or update or delete on public.member_availability_calendar
  for each row execute function public.log_audit();

create trigger audit_member_availability_recurring
  after insert or update or delete on public.member_availability_recurring
  for each row execute function public.log_audit();

-- Função de trigger não deve ser chamável diretamente via API.
revoke all on function public.guard_member_availability_scope() from public, anon, authenticated;
