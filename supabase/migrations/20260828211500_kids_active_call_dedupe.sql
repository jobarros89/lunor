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

create or replace function public.register_child_call(
  p_church uuid,
  p_ministry uuid,
  p_event uuid,
  p_checkin uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  loop
    update public.child_pages
    set
      reason = nullif(trim(coalesce(p_reason, '')), ''),
      created_by = auth.uid(),
      created_at = now()
    where church_id = p_church
      and ministry_id = p_ministry
      and event_id = p_event
      and checkin_id = p_checkin
      and kind = 'chamar'
      and resolved_at is null
    returning id into v_id;

    if v_id is not null then
      return v_id;
    end if;

    begin
      insert into public.child_pages (
        church_id,
        ministry_id,
        event_id,
        checkin_id,
        kind,
        reason,
        created_by
      ) values (
        p_church,
        p_ministry,
        p_event,
        p_checkin,
        'chamar',
        nullif(trim(coalesce(p_reason, '')), ''),
        auth.uid()
      )
      returning id into v_id;

      return v_id;
    exception
      when unique_violation then
        -- Outra requisição criou o chamado entre o UPDATE e o INSERT.
        -- Repetimos e atualizamos esse chamado em vez de duplicá-lo.
    end;
  end loop;
end;
$$;

grant execute on function public.register_child_call(uuid, uuid, uuid, uuid, text) to authenticated;
