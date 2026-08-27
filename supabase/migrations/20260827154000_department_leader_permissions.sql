-- Onde servir? (departments): admin/coordenador pode gerir toda a igreja;
-- gerente e líder podem gerir somente o próprio ministério.

drop policy if exists departments_manage on public.departments;
drop policy if exists departments_insert on public.departments;
drop policy if exists departments_update on public.departments;
drop policy if exists departments_delete on public.departments;

create policy departments_insert on public.departments
  for insert
  with check (
    public.is_church_coord(church_id)
    or public.has_ministry_role(
      ministry_id,
      array['gerente', 'lider']::public.ministry_role[]
    )
  );

create policy departments_update on public.departments
  for update
  using (
    public.is_church_coord(church_id)
    or public.has_ministry_role(
      ministry_id,
      array['gerente', 'lider']::public.ministry_role[]
    )
  )
  with check (
    public.is_church_coord(church_id)
    or public.has_ministry_role(
      ministry_id,
      array['gerente', 'lider']::public.ministry_role[]
    )
  );

create policy departments_delete on public.departments
  for delete
  using (
    public.is_church_coord(church_id)
    or public.has_ministry_role(
      ministry_id,
      array['gerente', 'lider']::public.ministry_role[]
    )
  );
