-- Departamentos passam a ser opcionais e contextuais por ministério.
-- Registros legados permanecem com ministry_id null para compatibilidade,
-- mas novos departamentos criados pelo app devem informar o ministério.

alter table public.departments
  add column if not exists ministry_id uuid references public.ministries (id) on delete cascade;

create index if not exists idx_departments_ministry
  on public.departments (ministry_id)
  where ministry_id is not null;

create or replace function public.enforce_department_ministry_church()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_church_id uuid;
begin
  if new.ministry_id is null then
    return new;
  end if;

  select church_id
    into v_church_id
  from public.ministries
  where id = new.ministry_id;

  if v_church_id is null then
    raise exception 'ministry_id % inexistente', new.ministry_id;
  end if;

  if v_church_id <> new.church_id then
    raise exception 'departamento e ministério devem pertencer à mesma igreja';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_department_ministry_church on public.departments;
create trigger trg_department_ministry_church
  before insert or update on public.departments
  for each row execute function public.enforce_department_ministry_church();

-- Um evento só pode usar um departamento do mesmo ministério.
create or replace function public.enforce_event_department_scope()
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

  select church_id, ministry_id
    into v_department_church, v_department_ministry
  from public.departments
  where id = new.department_id
    and active = true;

  if v_department_church is null then
    raise exception 'department_id % inexistente ou inativo', new.department_id;
  end if;

  if v_department_church <> new.church_id then
    raise exception 'evento e departamento devem pertencer à mesma igreja';
  end if;

  if new.ministry_id is null or v_department_ministry is null or v_department_ministry <> new.ministry_id then
    raise exception 'departamento deve pertencer ao ministério selecionado no evento';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_event_department_scope on public.events;
create trigger trg_event_department_scope
  before insert or update on public.events
  for each row execute function public.enforce_event_department_scope();
