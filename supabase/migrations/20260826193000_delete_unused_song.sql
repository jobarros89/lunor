-- Exclusão permanente de cadastros incorretos sem apagar repertórios históricos.
-- O lock da música impede que um novo setlist_item seja criado entre a
-- verificação de uso e o DELETE.
create or replace function public.delete_song(
  p_church_id uuid,
  p_song_id uuid
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not (
    public.is_louvor_leader(p_church_id)
    or public.is_church_coord(p_church_id)
  ) then
    raise exception 'sem permissão para excluir música'
      using errcode = '42501';
  end if;

  perform 1
  from public.songs
  where id = p_song_id
    and church_id = p_church_id
  for update;

  if not found then
    return 'not_found';
  end if;

  if exists (
    select 1
    from public.setlist_items
    where church_id = p_church_id
      and song_id = p_song_id
  ) then
    return 'in_use';
  end if;

  -- Rompe o ciclo entre a música e seu arranjo padrão. Os arranjos, versões
  -- e imports são removidos pelos FKs ON DELETE CASCADE já existentes.
  update public.songs
  set default_arrangement_id = null
  where id = p_song_id
    and church_id = p_church_id;

  delete from public.songs
  where id = p_song_id
    and church_id = p_church_id;

  return 'deleted';
end;
$$;

revoke all on function public.delete_song(uuid, uuid) from public, anon;
grant execute on function public.delete_song(uuid, uuid) to authenticated;

comment on function public.delete_song(uuid, uuid) is
  'Exclui uma música sem uso em repertórios, preservando o histórico quando houver referências.';
