-- LUNOR Louvor V1 — acesso ao módulo e ao acervo
-- O acervo completo e os materiais de ensaio pertencem ao Louvor.
-- A exceção intencional é a música de um repertório PUBLICADO para quem está
-- escalado naquele culto, preservando a colaboração com outros ministérios.

create or replace function public.is_louvor_member(p_church uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_ministry_member(public.louvor_ministry(p_church)),
    false
  );
$$;

revoke all on function public.is_louvor_member(uuid) from public;
grant execute on function public.is_louvor_member(uuid) to authenticated;

-- Acervo: Louvor/coord ve tudo. Pessoa de outro setor ve somente músicas que
-- fazem parte de repertório publicado de um evento no qual está escalada.
drop policy if exists songs_select on public.songs;
create policy songs_select
on public.songs for select
using (
  public.is_church_coord(church_id)
  or public.is_louvor_member(church_id)
  or exists (
    select 1
    from public.setlist_items si
    join public.events e on e.id = si.event_id
    where si.song_id = songs.id
      and si.church_id = songs.church_id
      and e.church_id = songs.church_id
      and e.setlist_status = 'publicado'
      and public.is_assigned_to_event(e.id)
  )
);

-- Metadados/arquivos de ensaio não atravessam o muro do Louvor.
drop policy if exists rehearsal_materials_select on public.rehearsal_materials;
create policy rehearsal_materials_select
on public.rehearsal_materials for select
using (
  public.is_church_coord(church_id)
  or public.is_louvor_member(church_id)
);

-- O bucket é privado, mas a policy anterior deixava qualquer membro da igreja
-- gerar signed URL. Restringe o objeto ao Louvor/coordenação.
drop policy if exists worship_materials_select on storage.objects;
create policy worship_materials_select
on storage.objects for select to authenticated
using (
  bucket_id = 'worship-materials'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (
    public.is_church_coord(((storage.foldername(name))[1])::uuid)
    or public.is_louvor_member(((storage.foldername(name))[1])::uuid)
  )
);
