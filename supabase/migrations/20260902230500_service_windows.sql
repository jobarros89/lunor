-- Separa o horário real do culto da janela de serviço de cada ministério.
-- Um mesmo evento pode ter Louvor, Kids, Mídia etc. chegando/saindo em horários diferentes.

alter table public.assignments
  add column if not exists release_time timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assignments_service_window_order'
  ) then
    alter table public.assignments
      add constraint assignments_service_window_order
      check (arrival_time is null or release_time is null or release_time > arrival_time);
  end if;
end $$;

create table if not exists public.event_ministry_windows (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  arrival_at timestamptz,
  release_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_ministry_windows_time_order
    check (arrival_at is null or release_at is null or release_at > arrival_at),
  constraint event_ministry_windows_event_ministry_unique
    unique (event_id, ministry_id)
);

create index if not exists event_ministry_windows_church_event_idx
  on public.event_ministry_windows(church_id, event_id);
create index if not exists event_ministry_windows_church_ministry_idx
  on public.event_ministry_windows(church_id, ministry_id);

alter table public.event_ministry_windows enable row level security;

drop policy if exists event_ministry_windows_select on public.event_ministry_windows;
create policy event_ministry_windows_select
on public.event_ministry_windows
for select
to authenticated
using (
  is_platform_admin()
  or is_church_member(church_id)
);

drop policy if exists event_ministry_windows_insert on public.event_ministry_windows;
create policy event_ministry_windows_insert
on public.event_ministry_windows
for insert
to authenticated
with check (
  (
    is_platform_admin()
    or is_church_coord(church_id)
    or has_ministry_role(ministry_id, array['gerente'::ministry_role, 'lider'::ministry_role])
  )
  and exists (
    select 1 from public.events e
    where e.id = event_id and e.church_id = church_id
  )
  and exists (
    select 1 from public.ministries m
    where m.id = ministry_id and m.church_id = church_id
  )
);

drop policy if exists event_ministry_windows_update on public.event_ministry_windows;
create policy event_ministry_windows_update
on public.event_ministry_windows
for update
to authenticated
using (
  is_platform_admin()
  or is_church_coord(church_id)
  or has_ministry_role(ministry_id, array['gerente'::ministry_role, 'lider'::ministry_role])
)
with check (
  (
    is_platform_admin()
    or is_church_coord(church_id)
    or has_ministry_role(ministry_id, array['gerente'::ministry_role, 'lider'::ministry_role])
  )
  and exists (
    select 1 from public.events e
    where e.id = event_id and e.church_id = church_id
  )
  and exists (
    select 1 from public.ministries m
    where m.id = ministry_id and m.church_id = church_id
  )
);

drop policy if exists event_ministry_windows_delete on public.event_ministry_windows;
create policy event_ministry_windows_delete
on public.event_ministry_windows
for delete
to authenticated
using (
  is_platform_admin()
  or is_church_coord(church_id)
  or has_ministry_role(ministry_id, array['gerente'::ministry_role, 'lider'::ministry_role])
);

grant select, insert, update, delete on public.event_ministry_windows to authenticated;

comment on table public.event_ministry_windows is
  'Janela de serviço de um ministério dentro de um evento: chegada e liberação independentes do horário do culto.';
comment on column public.assignments.arrival_time is
  'Override individual de chegada. Quando nulo, herda event_ministry_windows.arrival_at e depois events.starts_at.';
comment on column public.assignments.release_time is
  'Override individual de saída. Quando nulo, herda event_ministry_windows.release_at e depois events.ends_at.';
