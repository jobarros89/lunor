-- LUNOR Kids — cadastro de criança independente da janela de culto.
--
-- Cadastrar uma criança e seu responsável é manutenção da base do Kids.
-- Qualquer integrante ativo do ministério pode fazer esse cadastro a qualquer
-- momento. Check-in, check-out, chamadas e demais mutações operacionais seguem
-- protegidos por can_operate_kids().
--
-- p_event permanece na assinatura somente por compatibilidade com clientes
-- anteriores; ele não participa mais da autorização deste cadastro.

create or replace function public.create_child_with_primary_guardian(
  p_church uuid,
  p_ministry uuid,
  p_full_name text,
  p_birth_date date,
  p_allergies text default null,
  p_health_notes text default null,
  p_special_needs text default null,
  p_emergency_name text default null,
  p_emergency_phone text default null,
  p_photo_consent boolean default false,
  p_guardian_name text default null,
  p_guardian_phone text default null,
  p_guardian_relationship text default null,
  p_event uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian uuid;
  v_child uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if not exists (
    select 1
    from public.ministries m
    where m.id = p_ministry
      and m.church_id = p_church
  ) then
    raise exception 'invalid_kids_ministry';
  end if;

  if not (
    public.is_church_coord(p_church)
    or public.is_ministry_member(p_ministry)
  ) then
    raise exception 'kids_registration_requires_membership';
  end if;

  if p_full_name is null or char_length(trim(p_full_name)) < 2 then
    raise exception 'child_name_required';
  end if;

  if p_birth_date is null or p_birth_date > current_date then
    raise exception 'invalid_birth_date';
  end if;

  if p_guardian_name is null or char_length(trim(p_guardian_name)) < 2 then
    raise exception 'guardian_required';
  end if;

  insert into public.guardians (
    church_id,
    ministry_id,
    full_name,
    phone
  ) values (
    p_church,
    p_ministry,
    trim(p_guardian_name),
    nullif(trim(coalesce(p_guardian_phone, '')), '')
  )
  returning id into v_guardian;

  insert into public.children (
    church_id,
    ministry_id,
    full_name,
    birth_date,
    allergies,
    health_notes,
    special_needs,
    emergency_contact_name,
    emergency_contact_phone,
    consent_guardian_id,
    photo_consent,
    photo_consent_at
  ) values (
    p_church,
    p_ministry,
    trim(p_full_name),
    p_birth_date,
    nullif(trim(coalesce(p_allergies, '')), ''),
    nullif(trim(coalesce(p_health_notes, '')), ''),
    nullif(trim(coalesce(p_special_needs, '')), ''),
    nullif(trim(coalesce(p_emergency_name, '')), ''),
    nullif(trim(coalesce(p_emergency_phone, '')), ''),
    v_guardian,
    coalesce(p_photo_consent, false),
    case when coalesce(p_photo_consent, false) then now() else null end
  )
  returning id into v_child;

  insert into public.child_guardians (
    child_id,
    guardian_id,
    church_id,
    relationship,
    can_pickup,
    is_primary
  ) values (
    v_child,
    v_guardian,
    p_church,
    nullif(trim(coalesce(p_guardian_relationship, '')), ''),
    true,
    true
  );

  return v_child;
end;
$$;

revoke all on function public.create_child_with_primary_guardian(
  uuid, uuid, text, date, text, text, text, text, text, boolean, text, text, text, uuid
) from public;
revoke all on function public.create_child_with_primary_guardian(
  uuid, uuid, text, date, text, text, text, text, text, boolean, text, text, text, uuid
) from anon;
grant execute on function public.create_child_with_primary_guardian(
  uuid, uuid, text, date, text, text, text, text, text, boolean, text, text, text, uuid
) to authenticated;
