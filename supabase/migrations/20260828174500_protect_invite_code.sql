-- ============================================================
-- LUNOR — protege o código persistente de convite da igreja
-- ============================================================
-- RLS controla linhas, não colunas. Como todo membro ativo pode ler a linha
-- de `churches`, o grant de SELECT da tabela também tornava `invite_code`
-- legível via API. A partir daqui membros continuam lendo os metadados da
-- igreja, mas o token de convite só sai por RPC autorizada.

revoke select on table public.churches from authenticated;

-- Mantém acesso a todas as colunas atuais, exceto o segredo de convite.
-- O bloco dinâmico evita quebrar colunas adicionadas por migrations anteriores.
do $$
declare
  v_columns text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'churches'
    and column_name <> 'invite_code';

  if v_columns is null then
    raise exception 'churches_columns_not_found';
  end if;

  execute format('grant select (%s) on table public.churches to authenticated', v_columns);
end;
$$;

create or replace function public.get_church_invite_code(p_church uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if not (
    public.is_church_admin(p_church)
    or public.is_platform_admin()
  ) then
    raise exception 'invite_code_requires_admin';
  end if;

  select invite_code
    into v_code
  from public.churches
  where id = p_church;

  if v_code is null then
    raise exception 'church_not_found';
  end if;

  return v_code;
end;
$$;

grant execute on function public.get_church_invite_code(uuid) to authenticated;
