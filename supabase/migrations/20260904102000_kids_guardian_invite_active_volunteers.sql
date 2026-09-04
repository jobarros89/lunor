-- Kids: leitura do módulo para membro ativo + convite familiar sem gargalo de escala.
-- A geração do convite não depende de escala ou janela operacional.
-- Check-in, check-out e demais mutações operacionais continuam usando can_operate_kids().

create or replace function public.is_active_ministry_member(
  p_church uuid,
  p_ministry uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_church_coord(p_church)
    or exists (
      select 1
      from public.ministry_members mm
      where mm.church_id = p_church
        and mm.ministry_id = p_ministry
        and mm.user_id = auth.uid()
        and mm.active = true
    )
  );
$$;

revoke all on function public.is_active_ministry_member(uuid, uuid) from public;
revoke all on function public.is_active_ministry_member(uuid, uuid) from anon;
grant execute on function public.is_active_ministry_member(uuid, uuid) to authenticated;

-- Voluntário ativo consegue enxergar o conteúdo do Kids mesmo fora da janela
-- operacional. As policies de escrita permanecem vinculadas a can_operate_kids().
drop policy if exists children_select on public.children;
create policy children_select on public.children
  for select to authenticated
  using (
    public.is_active_ministry_member(church_id, ministry_id)
    or public.is_guardian_of(id)
  );

drop policy if exists guardians_select on public.guardians;
create policy guardians_select on public.guardians
  for select to authenticated
  using (
    public.is_active_ministry_member(church_id, ministry_id)
    or user_id = (select auth.uid())
  );

drop policy if exists child_guardians_select on public.child_guardians;
create policy child_guardians_select on public.child_guardians
  for select to authenticated
  using (
    public.is_guardian_of(child_id)
    or exists (
      select 1
      from public.children c
      where c.id = child_guardians.child_id
        and public.is_active_ministry_member(c.church_id, c.ministry_id)
    )
  );

create or replace function public.create_guardian_invite(p_guardian uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_guardian public.guardians%rowtype;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_guardian
  from public.guardians
  where id = p_guardian;

  if v_guardian.id is null then
    raise exception 'guardian_not_found';
  end if;

  if not public.is_active_ministry_member(
    v_guardian.church_id,
    v_guardian.ministry_id
  ) then
    raise exception 'not_allowed';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  update public.guardian_invites
  set expires_at = now()
  where guardian_id = p_guardian
    and used_at is null
    and expires_at > now();

  insert into public.guardian_invites (
    church_id,
    ministry_id,
    guardian_id,
    token_hash,
    created_by
  ) values (
    v_guardian.church_id,
    v_guardian.ministry_id,
    v_guardian.id,
    encode(digest(v_token, 'sha256'), 'hex'),
    auth.uid()
  );

  return v_token;
end;
$$;

revoke all on function public.create_guardian_invite(uuid) from public;
revoke all on function public.create_guardian_invite(uuid) from anon;
grant execute on function public.create_guardian_invite(uuid) to authenticated;
