alter table public.church_members
  add column if not exists onboarding_completed_at timestamptz;

create or replace function public.complete_member_onboarding(
  p_church_id uuid,
  p_ministry_id uuid,
  p_phone text,
  p_availability jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1 from public.church_members
    where church_id = p_church_id and user_id = v_user_id and status = 'active'
  ) then
    raise exception 'active church membership required';
  end if;

  if not exists (
    select 1 from public.ministries
    where id = p_ministry_id and church_id = p_church_id
  ) then
    raise exception 'invalid ministry';
  end if;

  insert into public.ministry_members (church_id, ministry_id, user_id, role, active)
  values (p_church_id, p_ministry_id, v_user_id, 'voluntario', true)
  on conflict (ministry_id, user_id) do update set active = true;

  update public.profiles
  set phone = nullif(btrim(p_phone), ''),
      availability = coalesce(p_availability, '{}'::jsonb),
      onboarding_completed = true,
      updated_at = now()
  where id = v_user_id;

  update public.church_members
  set onboarding_completed_at = now()
  where church_id = p_church_id and user_id = v_user_id;
end;
$$;

revoke all on function public.complete_member_onboarding(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.complete_member_onboarding(uuid, uuid, text, jsonb) to authenticated;

comment on function public.complete_member_onboarding(uuid, uuid, text, jsonb)
  is 'Completa o onboarding do próprio membro, validando igreja e ministério antes de criar o vínculo.';
