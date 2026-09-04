-- P0 onboarding de responsáveis Kids.
-- O convite passa a ser destinado a um e-mail e pode ser pré-visualizado
-- sem expor dados de criança, telefone ou ids internos.

alter table public.guardian_invites
  add column if not exists invited_email text;

alter table public.guardian_invites
  drop constraint if exists guardian_invites_invited_email_check;
alter table public.guardian_invites
  add constraint guardian_invites_invited_email_check
  check (
    invited_email is null
    or (
      char_length(invited_email) between 3 and 254
      and invited_email = lower(trim(invited_email))
      and invited_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  );

-- Convites antigos não tinham e-mail de destino. Mantê-los ativos impediria
-- garantir a identidade do destinatário, portanto precisam ser regenerados.
update public.guardian_invites
set expires_at = least(expires_at, now())
where used_at is null
  and invited_email is null;

-- Remove a assinatura antiga para que novos convites não possam ser criados
-- sem destinatário definido.
drop function if exists public.create_guardian_invite(uuid);

create or replace function public.create_guardian_invite(
  p_guardian uuid,
  p_email text
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_guardian public.guardians%rowtype;
  v_token text;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_email := lower(trim(coalesce(p_email, '')));
  if char_length(v_email) < 3
     or char_length(v_email) > 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_invite_email';
  end if;

  select * into v_guardian
  from public.guardians
  where id = p_guardian;

  if v_guardian.id is null then
    raise exception 'guardian_not_found';
  end if;

  if v_guardian.user_id is not null then
    raise exception 'guardian_already_linked';
  end if;

  if not public.can_operate_kids(
    v_guardian.church_id,
    v_guardian.ministry_id,
    null
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
    invited_email,
    created_by
  ) values (
    v_guardian.church_id,
    v_guardian.ministry_id,
    v_guardian.id,
    encode(digest(v_token, 'sha256'), 'hex'),
    v_email,
    auth.uid()
  );

  return v_token;
end;
$$;

revoke all on function public.create_guardian_invite(uuid, text) from public;
grant execute on function public.create_guardian_invite(uuid, text) to authenticated;

-- Prévia mínima do convite. O token funciona como segredo bearer; ainda assim
-- a função retorna somente nome do responsável, e-mail destinado e igreja.
-- Nenhuma criança, telefone, vínculo ou dado médico atravessa esta função.
create or replace function public.guardian_invite_preview(p_token text)
returns table (
  status text,
  guardian_name text,
  invited_email text,
  church_name text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invite public.guardian_invites%rowtype;
  v_guardian_name text;
  v_church_name text;
begin
  if p_token is null or trim(p_token) !~ '^[a-fA-F0-9]{48}$' then
    return query select 'invalid'::text, null::text, null::text, null::text;
    return;
  end if;

  select gi.*
    into v_invite
  from public.guardian_invites gi
  where gi.token_hash = encode(digest(trim(p_token), 'sha256'), 'hex')
  order by gi.created_at desc
  limit 1;

  if v_invite.id is null then
    return query select 'invalid'::text, null::text, null::text, null::text;
    return;
  end if;

  select g.full_name, c.name
    into v_guardian_name, v_church_name
  from public.guardians g
  join public.churches c on c.id = v_invite.church_id
  where g.id = v_invite.guardian_id;

  if v_invite.used_at is not null then
    return query select 'used'::text, v_guardian_name, v_invite.invited_email, v_church_name;
  elsif v_invite.expires_at <= now() then
    return query select 'expired'::text, v_guardian_name, v_invite.invited_email, v_church_name;
  else
    return query select 'valid'::text, v_guardian_name, v_invite.invited_email, v_church_name;
  end if;
end;
$$;

revoke all on function public.guardian_invite_preview(text) from public;
grant execute on function public.guardian_invite_preview(text) to anon, authenticated;

-- Resgate idempotente e vinculado ao e-mail convidado.
create or replace function public.redeem_guardian_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invite public.guardian_invites%rowtype;
  v_slug text;
  v_auth_email text;
  v_guardian_user uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_token is null or trim(p_token) !~ '^[a-fA-F0-9]{48}$' then
    raise exception 'invite_invalid';
  end if;

  select * into v_invite
  from public.guardian_invites
  where token_hash = encode(digest(trim(p_token), 'sha256'), 'hex')
  order by created_at desc
  limit 1
  for update;

  if v_invite.id is null then
    raise exception 'invite_invalid';
  end if;

  select g.user_id into v_guardian_user
  from public.guardians g
  where g.id = v_invite.guardian_id;

  -- Reabrir/recarregar um convite já concluído pela mesma conta é sucesso.
  if v_invite.used_at is not null then
    if v_invite.used_by = auth.uid() and v_guardian_user = auth.uid() then
      select c.slug into v_slug
      from public.churches c
      where c.id = v_invite.church_id;
      return v_slug;
    end if;
    raise exception 'invite_already_used';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'invite_expired';
  end if;

  v_auth_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  if v_invite.invited_email is not null
     and v_auth_email <> lower(trim(v_invite.invited_email)) then
    raise exception 'invite_email_mismatch';
  end if;

  if v_guardian_user is not null and v_guardian_user <> auth.uid() then
    raise exception 'guardian_already_linked';
  end if;

  update public.guardians
  set user_id = auth.uid()
  where id = v_invite.guardian_id
    and church_id = v_invite.church_id
    and ministry_id = v_invite.ministry_id;

  if not found then
    raise exception 'guardian_not_found';
  end if;

  update public.guardian_invites
  set used_at = now(), used_by = auth.uid()
  where id = v_invite.id;

  select c.slug into v_slug
  from public.churches c
  where c.id = v_invite.church_id;

  return v_slug;
end;
$$;

revoke all on function public.redeem_guardian_invite(text) from public;
grant execute on function public.redeem_guardian_invite(text) to authenticated;
