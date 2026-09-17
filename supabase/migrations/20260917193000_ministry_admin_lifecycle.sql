-- Administrative lifecycle for ministries without deleting historical references.
alter table public.ministries
  add column if not exists active boolean not null default true;

create index if not exists idx_ministries_church_active
  on public.ministries (church_id, active);

-- Keep the existing coordinator-only write boundary explicit for the new field.
drop policy if exists ministries_admin_write on public.ministries;
create policy ministries_admin_write on public.ministries
  for all
  using (public.is_church_coord(church_id))
  with check (public.is_church_coord(church_id));

-- Administrative updates must remain possible for inactive teams, while new
-- functions can only be attached to an active team.
create or replace function public.enforce_team_function_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_church_id uuid;
  v_ministry_id uuid;
  v_team_active boolean;
begin
  select church_id, ministry_id, active
    into v_church_id, v_ministry_id, v_team_active
  from public.departments
  where id = new.department_id;

  if v_church_id is null then
    raise exception 'team % inexistente', new.department_id;
  end if;
  if v_church_id <> new.church_id or v_ministry_id <> new.ministry_id then
    raise exception 'função, time e ministério devem pertencer à mesma igreja e hierarquia';
  end if;
  if tg_op = 'INSERT' and not v_team_active then
    raise exception 'não é possível criar função em time inativo';
  end if;
  return new;
end;
$$;

-- role_name is a historical snapshot. Changing status on an old assignment
-- must not fail because its function was later renamed or deactivated.
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

  if tg_op = 'UPDATE'
     and new.function_id is not distinct from old.function_id
     and new.church_id is not distinct from old.church_id
     and new.ministry_id is not distinct from old.ministry_id
     and new.department_id is not distinct from old.department_id then
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

  new.role_name := v_name;
  return new;
end;
$$;

-- The legacy department trigger also ran on every status update. Preserve old
-- assignments when their team is later deactivated; validate only new links.
create or replace function public.enforce_assignment_department_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_department_church uuid;
  v_department_ministry uuid;
begin
  if new.department_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.department_id is not distinct from old.department_id
     and new.church_id is not distinct from old.church_id
     and new.ministry_id is not distinct from old.ministry_id then
    return new;
  end if;

  select church_id, ministry_id
    into v_department_church, v_department_ministry
  from public.departments
  where id = new.department_id and active = true;

  if v_department_church is null then
    raise exception 'department_id % inexistente ou inativo', new.department_id;
  end if;
  if v_department_church <> new.church_id then
    raise exception 'escala e time devem pertencer à mesma igreja';
  end if;
  if v_department_ministry is null or v_department_ministry <> new.ministry_id then
    raise exception 'time deve pertencer ao ministério da escala';
  end if;
  return new;
end;
$$;
