-- LUNOR — voluntário do Louvor como colaborador operacional.
--
-- O voluntário pode manter o acervo e consultar repertórios/arranjos do Louvor,
-- mas ações de liderança permanecem separadas: montar/publicar repertório,
-- gerir a equipe da escala e excluir música definitivamente.

-- Acervo: qualquer integrante ativo do Louvor pode cadastrar e editar.
-- Exclusão permanente continua reservada a líder/gerente/coordenação.
drop policy if exists songs_write on public.songs;
drop policy if exists songs_insert_louvor_member on public.songs;
drop policy if exists songs_update_louvor_member on public.songs;
drop policy if exists songs_delete_louvor_leader on public.songs;

create policy songs_insert_louvor_member
on public.songs
for insert
to authenticated
with check (
  public.is_church_coord(church_id)
  or public.is_louvor_member(church_id)
);

create policy songs_update_louvor_member
on public.songs
for update
to authenticated
using (
  public.is_church_coord(church_id)
  or public.is_louvor_member(church_id)
)
with check (
  public.is_church_coord(church_id)
  or public.is_louvor_member(church_id)
);

create policy songs_delete_louvor_leader
on public.songs
for delete
to authenticated
using (
  public.is_church_coord(church_id)
  or public.is_louvor_leader(church_id)
);

-- Repertório: integrante do Louvor enxerga inclusive rascunhos para se preparar.
-- A escrita continua usando setlist_write, restrita à liderança do Louvor.
drop policy if exists setlist_select on public.setlist_items;
create policy setlist_select
on public.setlist_items
for select
to authenticated
using (
  public.is_church_coord(church_id)
  or public.is_louvor_member(church_id)
  or (
    public.is_assigned_to_event(event_id)
    and exists (
      select 1
      from public.events e
      where e.id = event_id
        and e.church_id = setlist_items.church_id
        and e.setlist_status = 'publicado'
    )
  )
);

comment on policy songs_insert_louvor_member on public.songs is
  'Integrante ativo do Louvor pode cadastrar música no acervo.';
comment on policy songs_update_louvor_member on public.songs is
  'Integrante ativo do Louvor pode editar e arquivar música do acervo.';
comment on policy songs_delete_louvor_leader on public.songs is
  'Exclusão permanente do acervo permanece restrita à liderança/coordenação.';
comment on policy setlist_select on public.setlist_items is
  'Integrante do Louvor lê repertórios inclusive em rascunho; outros escalados somente quando publicado.';
