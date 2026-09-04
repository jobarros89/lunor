-- Kids: qualquer voluntário ativo do ministério pode gerar convite familiar.
-- A geração do convite não depende de escala ou janela operacional.
-- Check-in, check-out e demais ações operacionais continuam usando can_operate_kids().

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

  if not (
    public.is_church_coord(v_guardian.church_id)
    or exists (
      select 1
      from public.ministry_members mm
      where mm.church_id = v_guardian.church_id
        and mm.ministry_id = v_guardian.ministry_id
        and mm.user_id = auth.uid()
        and mm.active = true
    )
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
