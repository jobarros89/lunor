-- "Onde vai servir?" passa a pertencer à pessoa escalada, não ao evento.
-- Mantemos events.department_id por compatibilidade com dados legados, mas novos
-- fluxos de criação de evento não o utilizam.

alter table public.assignments
  add column if not exists department_id uuid references public.departments (id) on delete set null;

create index if not exists idx_assignments_department
  on public.assignments (department_id)
  where department_id is not null;

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

  select church_id, ministry_id
    into v_department_church, v_department_ministry
  from public.departments
  where id = new.department_id
    and active = true;

  if v_department_church is null then
    raise exception 'department_id % inexistente ou inativo', new.department_id;
  end if;

  if v_department_church <> new.church_id then
    raise exception 'escala e onde vai servir devem pertencer à mesma igreja';
  end if;

  if v_department_ministry is null or v_department_ministry <> new.ministry_id then
    raise exception 'onde vai servir deve pertencer ao ministério da escala';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assignment_department_scope on public.assignments;
create trigger trg_assignment_department_scope
  before insert or update on public.assignments
  for each row execute function public.enforce_assignment_department_scope();
