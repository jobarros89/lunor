-- Avisos de fim da sessão do Kids expiram automaticamente após 20 minutos.
-- Chamadas individuais continuam ativas até confirmação/resolução operacional.

create or replace function public.expire_stale_child_session_pages(p_church uuid)
returns void
language sql volatile security definer set search_path = public as $$
  update public.child_pages
  set resolved_at = coalesce(resolved_at, now())
  where church_id = p_church
    and kind = 'fim_sessao'
    and resolved_at is null
    and created_at <= now() - interval '20 minutes';
$$;

revoke all on function public.expire_stale_child_session_pages(uuid) from public;

create or replace function public.meus_anuncios_infantil(p_church uuid)
returns table (
  page_id uuid,
  code text,
  kind public.child_page_kind,
  created_at timestamptz
)
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.expire_stale_child_session_pages(p_church);

  return query
  select p.id, k.code, p.kind, p.created_at
  from public.child_page_recipients r
  join public.child_pages p on p.id = r.page_id
  left join public.child_checkins k on k.id = p.checkin_id
  where r.user_id = auth.uid()
    and r.acknowledged_at is null
    and p.resolved_at is null
    and p.church_id = p_church
    and public.is_church_member(p_church)
  order by p.created_at desc
  limit 20;
end;
$$;

revoke all on function public.meus_anuncios_infantil(uuid) from public;
grant execute on function public.meus_anuncios_infantil(uuid) to authenticated;

create or replace function public.anuncios_infantil(p_church uuid)
returns table (code text, kind public.child_page_kind, created_at timestamptz)
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.expire_stale_child_session_pages(p_church);

  return query
  select k.code, p.kind, p.created_at
  from public.child_pages p
  left join public.child_checkins k on k.id = p.checkin_id
  where p.church_id = p_church
    and p.resolved_at is null
    and public.is_church_member(p_church)
    and not exists (
      select 1
      from public.child_page_recipients r
      where r.page_id = p.id
        and r.user_id = auth.uid()
    )
  order by p.created_at desc
  limit 20;
end;
$$;

revoke all on function public.anuncios_infantil(uuid) from public;
grant execute on function public.anuncios_infantil(uuid) to authenticated;

-- Limpa qualquer aviso de fim da sessão que já esteja vencido no momento do deploy.
update public.child_pages
set resolved_at = coalesce(resolved_at, now())
where kind = 'fim_sessao'
  and resolved_at is null
  and created_at <= now() - interval '20 minutes';
