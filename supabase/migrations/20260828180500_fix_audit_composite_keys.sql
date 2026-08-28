-- ============================================================
-- LUNOR — auditoria compatível com tabelas sem coluna `id`
-- ============================================================
-- `child_guardians` usa chave composta (child_id, guardian_id). O trigger
-- genérico anterior acessava NEW.id/OLD.id diretamente e, por isso, impedia
-- inserts/updates/deletes nessa tabela. Esta migration é forward-only porque
-- a versão anterior já chegou à produção.

create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_old jsonb;
  v_new jsonb;
  v_church uuid;
  v_record text;
  v_diff jsonb;
  v_action text;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_row := v_old;
    v_diff := v_old;
    v_action := 'delete';
  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_row := v_new;
    v_diff := v_new;
    v_action := 'insert';
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_row := v_new;
    v_diff := public.jsonb_changed_fields(v_old, v_new);
    v_action := 'update';
  end if;

  -- JSONB evita referenciar campos que não existem no tipo de registro do
  -- trigger. Todas as tabelas auditadas atualmente possuem church_id.
  v_church := nullif(v_row ->> 'church_id', '')::uuid;

  -- Prefere a PK simples. Para autorizações Kids, registra a chave composta
  -- de forma legível. Os fallbacks preservam utilidade em futuras tabelas.
  v_record := coalesce(
    nullif(v_row ->> 'id', ''),
    case
      when nullif(v_row ->> 'child_id', '') is not null
       and nullif(v_row ->> 'guardian_id', '') is not null
      then (v_row ->> 'child_id') || ':' || (v_row ->> 'guardian_id')
    end,
    nullif(v_row ->> 'user_id', ''),
    nullif(v_row ->> 'event_id', ''),
    nullif(v_row ->> 'church_id', '')
  );

  insert into public.audit_logs (
    church_id,
    user_id,
    table_name,
    record_id,
    action,
    diff
  ) values (
    v_church,
    auth.uid(),
    tg_table_name,
    v_record,
    v_action,
    coalesce(v_diff, '{}'::jsonb)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
