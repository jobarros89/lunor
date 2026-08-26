alter table public.church_members
  add column if not exists onboarding_completed_at timestamptz;

create or replace function public.complete_member_onboarding(
  p_church_id uuid,
  p_ministry_ids uuid[],
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

  if coalesce(cardinality(p_ministry_ids), 0) = 0 then
    raise exception 'at least one ministry is required';
  end if;

  if exists (
    select 1
    from unnest(p_ministry_ids) as requested(id)
    left join public.ministries m
      on m.id = requested.id
     and m.church_id = p_church_id
    where m.id is null
  ) then
    raise exception 'invalid ministry';
  end if;

  insert into public.ministry_members (church_id, ministry_id, user_id, role, active)
  select p_church_id, m.id, v_user_id, 'voluntario', true
  from public.ministries m
  where m.church_id = p_church_id
    and m.id = any(p_ministry_ids)
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

revoke all on function public.complete_member_onboarding(uuid, uuid[], text, jsonb) from public, anon;
grant execute on function public.complete_member_onboarding(uuid, uuid[], text, jsonb) to authenticated;

comment on function public.complete_member_onboarding(uuid, uuid[], text, jsonb)
  is 'Completa o onboarding do próprio membro, validando a igreja e todos os ministérios antes de criar os vínculos.';
