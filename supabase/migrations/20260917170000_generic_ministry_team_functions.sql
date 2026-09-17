-- Generic hierarchy: ministry/area -> team -> function.
-- Existing ministries and departments remain compatible with the current application.

alter table public.ministries
  add column if not exists module_key text not null default 'generic'
  check (module_key in ('generic', 'worship', 'kids'));

-- One-time compatibility backfill. Runtime code no longer depends on names or slugs.
update public.ministries
set module_key = 'worship'
where module_key = 'generic'
  and (lower(slug) = 'louvor' or lower(name) like '%louvor%');

update public.ministries
set module_key = 'kids'
where module_key = 'generic'
  and (
    lower(slug) in ('kids', 'infantil', 'criancas', 'crianças')
    or lower(name) like any (array['%kids%', '%infantil%', '%criancas%', '%crianças%'])
  );

create unique index if not exists idx_ministries_church_module
  on public.ministries (church_id, module_key)
  where module_key <> 'generic';

create table if not exists public.team_functions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  ministry_id uuid not null references public.ministries (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (department_id, name)
);

create index if not exists idx_team_functions_church
  on public.team_functions (church_id);
create index if not exists idx_team_functions_ministry
  on public.team_functions (ministry_id);
create index if not exists idx_team_functions_department
  on public.team_functions (department_id);

create or replace function public.enforce_team_function_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_church_id uuid;
  v_ministry_id uuid;
begin
  select church_id, ministry_id
    into v_church_id, v_ministry_id
  from public.departments
  where id = new.department_id and active = true;

  if v_church_id is null then
    raise exception 'team % inexistente ou inativo', new.department_id;
  end if;
  if v_church_id <> new.church_id or v_ministry_id <> new.ministry_id then
    raise exception 'função, time e ministério devem pertencer à mesma igreja e hierarquia';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_team_function_scope on public.team_functions;
create trigger trg_team_function_scope
  before insert or update on public.team_functions
  for each row execute function public.enforce_team_function_scope();

alter table public.team_functions enable row level security;

create policy team_functions_select on public.team_functions
  for select using (public.is_church_member(church_id));

create policy team_functions_insert on public.team_functions
  for insert with check (
    public.is_church_coord(church_id)
    or public.has_ministry_role(
      ministry_id,
      array['gerente', 'lider']::public.ministry_role[]
    )
  );

create policy team_functions_update on public.team_functions
  for update
  using (
    public.is_church_coord(church_id)
    or public.has_ministry_role(
      ministry_id,
      array['gerente', 'lider']::public.ministry_role[]
    )
  )
  with check (
    public.is_church_coord(church_id)
    or public.has_ministry_role(
      ministry_id,
      array['gerente', 'lider']::public.ministry_role[]
    )
  );

create policy team_functions_delete on public.team_functions
  for delete using (
    public.is_church_coord(church_id)
    or public.has_ministry_role(
      ministry_id,
      array['gerente', 'lider']::public.ministry_role[]
    )
  );

grant select, insert, update, delete on public.team_functions to authenticated;

alter table public.assignments
  add column if not exists function_id uuid
  references public.team_functions (id) on delete set null;

create index if not exists idx_assignments_function
  on public.assignments (function_id)
  where function_id is not null;

create or replace function public.enforce_assignment_function_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_church_id uuid;
  v_ministry_id uuid;
  v_department_id uuid;
  v_name text;
begin
  if new.function_id is null then
    return new;
  end if;

  select church_id, ministry_id, department_id, name
    into v_church_id, v_ministry_id, v_department_id, v_name
  from public.team_functions
  where id = new.function_id and active = true;

  if v_church_id is null then
    raise exception 'function_id % inexistente ou inativo', new.function_id;
  end if;
  if v_church_id <> new.church_id
     or v_ministry_id <> new.ministry_id
     or v_department_id <> new.department_id then
    raise exception 'função deve pertencer à igreja, ministério e time da escala';
  end if;

  -- Preserve role_name as the compatibility/display snapshot.
  new.role_name := v_name;
  return new;
end;
$$;

drop trigger if exists trg_assignment_function_scope on public.assignments;
create trigger trg_assignment_function_scope
  before insert or update on public.assignments
  for each row execute function public.enforce_assignment_function_scope();
