-- Mantém a confirmação pessoal disponível mesmo quando a operação do chamado
-- já foi resolvida pela recepção/checkout. Isso evita perder o ACK quando o
-- responsável abre o Push alguns segundos depois da resolução operacional.

create or replace function public.meus_anuncios_infantil(p_church uuid)
returns table (
  page_id uuid,
  code text,
  kind public.child_page_kind,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, k.code, p.kind, p.created_at
  from public.child_page_recipients r
  join public.child_pages p on p.id = r.page_id
  left join public.child_checkins k on k.id = p.checkin_id
  where r.user_id = auth.uid()
    and r.acknowledged_at is null
    and p.church_id = p_church
    and public.is_church_member(p_church)
    and (
      p.resolved_at is null
      or (
        p.kind = 'chamar'
        and p.created_at > now() - interval '20 minutes'
      )
    )
    and (
      p.kind <> 'fim_sessao'
      or p.created_at > now() - interval '20 minutes'
    )
  order by p.created_at desc
  limit 20;
$$;

revoke all on function public.meus_anuncios_infantil(uuid) from public;
grant execute on function public.meus_anuncios_infantil(uuid) to authenticated;
