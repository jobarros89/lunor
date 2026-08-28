-- Faz o insert atual da aplicação se comportar como renovação quando já existe
-- um chamado ativo para o mesmo check-in. Mantém compatibilidade com clientes
-- existentes e preserva o reenvio de push/SMS após a operação no banco.

create or replace function public.dedupe_active_child_call_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing_id uuid;
begin
  if new.kind <> 'chamar' or new.checkin_id is null then
    return new;
  end if;

  -- Serializa chamadas concorrentes para o mesmo check-in.
  perform pg_advisory_xact_lock(hashtextextended(new.checkin_id::text, 0));

  update public.child_pages
  set
    reason = new.reason,
    created_by = new.created_by,
    created_at = coalesce(new.created_at, now())
  where checkin_id = new.checkin_id
    and kind = 'chamar'
    and resolved_at is null
  returning id into v_existing_id;

  if v_existing_id is not null then
    -- Cancela somente a nova linha; o chamado ativo já foi renovado.
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists child_pages_dedupe_active_call on public.child_pages;
create trigger child_pages_dedupe_active_call
before insert on public.child_pages
for each row
execute function public.dedupe_active_child_call_before_insert();
