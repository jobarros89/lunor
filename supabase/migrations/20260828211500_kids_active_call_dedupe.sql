-- Mantém no máximo um chamado ativo por check-in.
-- Repetir "Chamar" atualiza o mesmo estado operacional, sem poluir a home.

-- Resolve duplicatas antigas, preservando o chamado ativo mais recente.
with ranked as (
  select
    id,
    row_number() over (
      partition by checkin_id
      order by created_at desc, id desc
    ) as rn
  from public.child_pages
  where kind = 'chamar'
    and resolved_at is null
    and checkin_id is not null
)
update public.child_pages p
set
  resolved_at = now(),
  resolved_by = coalesce(p.resolved_by, p.created_by)
from ranked r
where p.id = r.id
  and r.rn > 1;

create unique index if not exists child_pages_one_active_call_per_checkin
  on public.child_pages (checkin_id)
  where kind = 'chamar'
    and resolved_at is null
    and checkin_id is not null;

-- Mantém o contrato atual da aplicação: INSERT continua retornando sucesso,
-- mas um segundo chamado para o mesmo check-in apenas renova o registro ativo.
create or replace function public.dedupe_active_child_call()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.kind = 'chamar'
     and new.resolved_at is null
     and new.checkin_id is not null then
    update public.child_pages
    set
      reason = new.reason,
      created_by = new.created_by,
      created_at = now()
    where checkin_id = new.checkin_id
      and kind = 'chamar'
      and resolved_at is null;

    if found then
      return null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists dedupe_active_child_call on public.child_pages;
create trigger dedupe_active_child_call
before insert on public.child_pages
for each row
execute function public.dedupe_active_child_call();
