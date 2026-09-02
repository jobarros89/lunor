-- Kids: acesso operacional por escala + acesso familiar restrito.
-- A barreira principal fica no Postgres/RLS; a interface apenas reflete a permissão.

create or replace function public.is_event_operational(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event
      and now() >= e.starts_at - interval '90 minutes'
      and now() <= coalesce(e.ends_at, e.starts_at + interval '4 hours') + interval '60 minutes'
  );
$$;

create or replace function public.is_guardian_at_church(p_church uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.guardians g
    where g.church_id = p_church
      and g.user_id = auth.uid()
  );
$$;

create or replace function public.is_guardian_of(p_child uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.child_guardians cg
    join public.guardians g on g.id = cg.guardian_id
    where cg.child_id = p_child
      and g.user_id = auth.uid()
  );
$$;

create or replace function public.can_operate_kids(
  p_church uuid,
  p_ministry uuid,
  p_event uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_church_coord(p_church)
    or public.has_ministry_role(
      p_ministry,
      array['gerente', 'lider']::public.ministry_role[]
    )
    or exists (
      select 1
      from public.assignments a
      join public.events e on e.id = a.event_id
      where a.user_id = auth.uid()
        and a.church_id = p_church
        and a.ministry_id = p_ministry
        and a.status not in ('substituido', 'ausente')
        and e.church_id = p_church
        and (p_event is null or e.id = p_event)
        and public.is_event_operational(e.id)
    )
  );
$$;

revoke all on function public.is_event_operational(uuid) from public;
revoke all on function public.is_event_operational(uuid) from anon;
revoke all on function public.is_guardian_at_church(uuid) from public;
revoke all on function public.is_guardian_at_church(uuid) from anon;
revoke all on function public.is_guardian_of(uuid) from public;
revoke all on function public.is_guardian_of(uuid) from anon;
revoke all on function public.can_operate_kids(uuid, uuid, uuid) from public;
revoke all on function public.can_operate_kids(uuid, uuid, uuid) from anon;
grant execute on function public.is_event_operational(uuid) to authenticated;
grant execute on function public.is_guardian_at_church(uuid) to authenticated;
grant execute on function public.is_guardian_of(uuid) to authenticated;
grant execute on function public.can_operate_kids(uuid, uuid, uuid) to authenticated;

-- Leitura do responsável: somente as crianças às quais a conta está ligada.
drop policy if exists children_select on public.children;
drop policy if exists children_manage on public.children;
create policy children_select on public.children
  for select to authenticated
  using (
    public.can_operate_kids(church_id, ministry_id, null)
    or public.is_guardian_of(id)
  );
create policy children_manage on public.children
  for all to authenticated
  using (public.can_operate_kids(church_id, ministry_id, null))
  with check (public.can_operate_kids(church_id, ministry_id, null));

drop policy if exists guardians_select on public.guardians;
drop policy if exists guardians_manage on public.guardians;
create policy guardians_select on public.guardians
  for select to authenticated
  using (
    public.can_operate_kids(church_id, ministry_id, null)
    or user_id = (select auth.uid())
  );
create policy guardians_manage on public.guardians
  for all to authenticated
  using (public.can_operate_kids(church_id, ministry_id, null))
  with check (public.can_operate_kids(church_id, ministry_id, null));

drop policy if exists child_guardians_select on public.child_guardians;
drop policy if exists child_guardians_manage on public.child_guardians;
create policy child_guardians_select on public.child_guardians
  for select to authenticated
  using (
    public.is_guardian_of(child_id)
    or exists (
      select 1 from public.children c
      where c.id = child_guardians.child_id
        and public.can_operate_kids(c.church_id, c.ministry_id, null)
    )
  );
create policy child_guardians_manage on public.child_guardians
  for all to authenticated
  using (
    exists (
      select 1 from public.children c
      where c.id = child_guardians.child_id
        and public.can_operate_kids(c.church_id, c.ministry_id, null)
    )
  )
  with check (
    exists (
      select 1 from public.children c
      where c.id = child_guardians.child_id
        and c.church_id = child_guardians.church_id
        and public.can_operate_kids(c.church_id, c.ministry_id, null)
    )
  );

drop policy if exists child_checkins_select on public.child_checkins;
drop policy if exists child_checkins_insert on public.child_checkins;
drop policy if exists child_checkins_update on public.child_checkins;
create policy child_checkins_select on public.child_checkins
  for select to authenticated
  using (
    public.can_operate_kids(church_id, ministry_id, event_id)
    or public.is_guardian_of(child_id)
  );
create policy child_checkins_insert on public.child_checkins
  for insert to authenticated
  with check (public.can_operate_kids(church_id, ministry_id, event_id));
create policy child_checkins_update on public.child_checkins
  for update to authenticated
  using (public.can_operate_kids(church_id, ministry_id, event_id))
  with check (public.can_operate_kids(church_id, ministry_id, event_id));

drop policy if exists child_pages_select on public.child_pages;
drop policy if exists child_pages_insert on public.child_pages;
create policy child_pages_select on public.child_pages
  for select to authenticated
  using (public.can_operate_kids(church_id, ministry_id, event_id));
create policy child_pages_insert on public.child_pages
  for insert to authenticated
  with check (
    (
      kind = 'chamar'
      and public.can_operate_kids(church_id, ministry_id, event_id)
    )
    or (
      kind = 'fim_sessao'
      and (
        public.is_church_coord(church_id)
        or public.has_ministry_role(
          ministry_id,
          array['gerente', 'lider']::public.ministry_role[]
        )
      )
    )
  );

-- Responsável sem vínculo de voluntário consegue resolver somente a igreja e o Kids.
drop policy if exists churches_guardian_select on public.churches;
create policy churches_guardian_select on public.churches
  for select to authenticated
  using (public.is_guardian_at_church(id));

drop policy if exists ministries_guardian_select on public.ministries;
create policy ministries_guardian_select on public.ministries
  for select to authenticated
  using (public.is_guardian_at_church(church_id));

drop policy if exists events_guardian_select on public.events;

create or replace function public.guardian_current_kids_event(
  p_church uuid,
  p_ministry uuid
)
returns table(id uuid, title text, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.title, e.starts_at, e.ends_at
  from public.events e
  where e.church_id = p_church
    and public.is_event_operational(e.id)
    and exists (
      select 1
      from public.guardians g
      where g.church_id = p_church
        and g.ministry_id = p_ministry
        and g.user_id = auth.uid()
    )
  order by e.starts_at
  limit 1;
$$;

revoke all on function public.guardian_current_kids_event(uuid, uuid) from public, anon;
grant execute on function public.guardian_current_kids_event(uuid, uuid) to authenticated;

-- Convite familiar: o token puro só é retornado uma vez pela RPC.
create table if not exists public.guardian_invites (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  used_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists guardian_invites_guardian_active_idx
  on public.guardian_invites (guardian_id, expires_at desc)
  where used_at is null;

alter table public.guardian_invites enable row level security;
revoke all on table public.guardian_invites from anon, authenticated;

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

create or replace function public.redeem_guardian_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invite public.guardian_invites%rowtype;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_invite
  from public.guardian_invites
  where token_hash = encode(digest(trim(p_token), 'sha256'), 'hex')
    and used_at is null
    and expires_at > now()
  for update;

  if v_invite.id is null then
    raise exception 'invite_invalid_or_expired';
  end if;

  if exists (
    select 1 from public.guardians g
    where g.id = v_invite.guardian_id
      and g.user_id is not null
      and g.user_id <> auth.uid()
  ) then
    raise exception 'guardian_already_linked';
  end if;

  update public.guardians
  set user_id = auth.uid()
  where id = v_invite.guardian_id
    and church_id = v_invite.church_id
    and ministry_id = v_invite.ministry_id;

  update public.guardian_invites
  set used_at = now(), used_by = auth.uid()
  where id = v_invite.id;

  select c.slug into v_slug
  from public.churches c
  where c.id = v_invite.church_id;

  return v_slug;
end;
$$;

revoke all on function public.create_guardian_invite(uuid) from public;
revoke all on function public.create_guardian_invite(uuid) from anon;
revoke all on function public.redeem_guardian_invite(text) from public;
revoke all on function public.redeem_guardian_invite(text) from anon;
grant execute on function public.create_guardian_invite(uuid) to authenticated;
grant execute on function public.redeem_guardian_invite(text) to authenticated;

-- Autoatendimento familiar. O checkout grava qual responsável autorizado retirou.
create or replace function public.guardian_checkin_child(
  p_church uuid,
  p_ministry uuid,
  p_event uuid,
  p_child uuid,
  p_class uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checkin uuid;
  v_code text;
begin
  if auth.uid() is null or not public.is_guardian_of(p_child) then
    raise exception 'not_allowed';
  end if;

  if not public.is_event_operational(p_event)
     or not exists (
       select 1 from public.events e
       where e.id = p_event and e.church_id = p_church
     )
     or not exists (
       select 1 from public.children c
       where c.id = p_child
         and c.church_id = p_church
         and c.ministry_id = p_ministry
         and c.active
     ) then
    raise exception 'operation_not_available';
  end if;

  if exists (
    select 1 from public.child_checkins c
    where c.event_id = p_event
      and c.child_id = p_child
      and c.checked_out_at is null
  ) then
    raise exception 'already_checked_in';
  end if;

  for i in 1..20 loop
    v_code := (100 + floor(random() * 900))::integer::text;
    begin
      insert into public.child_checkins (
        church_id, ministry_id, event_id, class_id, child_id, code, checked_in_by
      ) values (
        p_church, p_ministry, p_event, p_class, p_child, v_code, auth.uid()
      ) returning id into v_checkin;
      return v_checkin;
    exception when unique_violation then
      null;
    end;
  end loop;

  raise exception 'code_generation_failed';
end;
$$;

create or replace function public.guardian_checkout_child(p_checkin uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.child_checkins%rowtype;
  v_guardian uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select c.* into v_row
  from public.child_checkins c
  where c.id = p_checkin
    and c.checked_out_at is null
  for update;

  if v_row.id is null or not public.is_event_operational(v_row.event_id) then
    raise exception 'operation_not_available';
  end if;

  select g.id into v_guardian
  from public.child_guardians cg
  join public.guardians g on g.id = cg.guardian_id
  where cg.child_id = v_row.child_id
    and cg.can_pickup
    and g.user_id = auth.uid()
  order by cg.is_primary desc, cg.created_at
  limit 1;

  if v_guardian is null then
    raise exception 'pickup_not_authorized';
  end if;

  update public.child_checkins
  set picked_up_by = v_guardian,
      checked_out_at = now(),
      checked_out_by = auth.uid()
  where id = v_row.id;

  return v_row.event_id;
end;
$$;

revoke all on function public.guardian_checkin_child(uuid, uuid, uuid, uuid, uuid) from public;
revoke all on function public.guardian_checkin_child(uuid, uuid, uuid, uuid, uuid) from anon;
revoke all on function public.guardian_checkout_child(uuid) from public;
revoke all on function public.guardian_checkout_child(uuid) from anon;
grant execute on function public.guardian_checkin_child(uuid, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.guardian_checkout_child(uuid) to authenticated;

-- Cadastro na recepção passa a exigir a operação/escala quando é voluntário.
drop function if exists public.create_child_with_primary_guardian(
  uuid, uuid, text, date, text, text, text, text, text, boolean, text, text, text
);

create function public.create_child_with_primary_guardian(
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
    select 1 from public.ministries m
    where m.id = p_ministry and m.church_id = p_church
  ) then
    raise exception 'invalid_kids_ministry';
  end if;

  if not public.can_operate_kids(p_church, p_ministry, p_event) then
    raise exception 'kids_registration_requires_active_assignment';
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

  insert into public.guardians (church_id, ministry_id, full_name, phone)
  values (
    p_church,
    p_ministry,
    trim(p_guardian_name),
    nullif(trim(coalesce(p_guardian_phone, '')), '')
  ) returning id into v_guardian;

  insert into public.children (
    church_id, ministry_id, full_name, birth_date, allergies, health_notes,
    special_needs, emergency_contact_name, emergency_contact_phone,
    consent_guardian_id, photo_consent, photo_consent_at
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
  ) returning id into v_child;

  insert into public.child_guardians (
    child_id, guardian_id, church_id, relationship, can_pickup, is_primary
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

-- Chamadas e painel operacional também respeitam a escala do evento.
create or replace function public.dedupe_active_child_call_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
begin
  if new.kind <> 'chamar' or new.checkin_id is null then
    return new;
  end if;
  if auth.uid() is null
     or not public.can_operate_kids(new.church_id, new.ministry_id, new.event_id) then
    raise exception 'not_authorized';
  end if;
  if not exists (
    select 1 from public.child_checkins c
    where c.id = new.checkin_id
      and c.church_id = new.church_id
      and c.ministry_id = new.ministry_id
      and c.event_id = new.event_id
      and c.checked_out_at is null
  ) then
    raise exception 'kids_page_checkin_mismatch';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.checkin_id::text, 0));
  update public.child_pages
  set reason = new.reason,
      created_by = new.created_by,
      created_at = coalesce(new.created_at, now())
  where church_id = new.church_id
    and ministry_id = new.ministry_id
    and event_id = new.event_id
    and checkin_id = new.checkin_id
    and kind = 'chamar'
    and resolved_at is null
  returning id into v_existing_id;

  if v_existing_id is not null then return null; end if;
  return new;
end;
$$;

revoke all on function public.dedupe_active_child_call_before_insert() from public, anon, authenticated;

create or replace function public.child_page_delivery_status(p_event uuid)
returns table(
  page_id uuid,
  checkin_id uuid,
  kind public.child_page_kind,
  recipient_count bigint,
  acknowledged_count bigint,
  last_acknowledged_at timestamptz,
  created_at timestamptz,
  resolved_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.checkin_id,
    p.kind,
    count(r.user_id),
    count(r.acknowledged_at),
    max(r.acknowledged_at),
    p.created_at,
    p.resolved_at
  from public.child_pages p
  left join public.child_page_recipients r on r.page_id = p.id
  where p.event_id = p_event
    and public.can_operate_kids(p.church_id, p.ministry_id, p.event_id)
  group by p.id, p.checkin_id, p.kind, p.created_at, p.resolved_at
  order by p.created_at desc
  limit 100;
$$;

revoke all on function public.child_page_delivery_status(uuid) from public, anon;
grant execute on function public.child_page_delivery_status(uuid) to authenticated;

-- Auditoria cobre ficha, responsável, vínculo familiar e presença.
drop trigger if exists audit_guardians on public.guardians;
create trigger audit_guardians
  after insert or update or delete on public.guardians
  for each row execute function public.log_audit();

create or replace function public.log_child_guardian_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_action text;
  v_church uuid;
  v_record text;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
    v_action := 'delete';
    v_church := old.church_id;
    v_record := old.child_id::text || ':' || old.guardian_id::text;
  elsif tg_op = 'INSERT' then
    v_row := to_jsonb(new);
    v_action := 'insert';
    v_church := new.church_id;
    v_record := new.child_id::text || ':' || new.guardian_id::text;
  else
    v_row := public.jsonb_changed_fields(to_jsonb(old), to_jsonb(new));
    v_action := 'update';
    v_church := new.church_id;
    v_record := new.child_id::text || ':' || new.guardian_id::text;
  end if;

  insert into public.audit_logs (
    church_id, user_id, table_name, record_id, action, diff
  ) values (
    v_church, auth.uid(), tg_table_name, v_record, v_action, v_row
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.log_child_guardian_audit() from public, anon, authenticated;

drop trigger if exists audit_child_guardians on public.child_guardians;
create trigger audit_child_guardians
  after insert or update or delete on public.child_guardians
  for each row execute function public.log_child_guardian_audit();

-- Repetir o onboarding não mantém ministérios de voluntário que foram desmarcados.
create or replace function public.complete_member_onboarding(
  p_church_id uuid,
  p_ministry_ids uuid[],
  p_phone text,
  p_availability jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.church_members
    where church_id = p_church_id
      and user_id = v_user_id
      and status = 'active'
  ) then raise exception 'active church membership required'; end if;
  if coalesce(cardinality(p_ministry_ids), 0) = 0 then
    raise exception 'at least one ministry is required';
  end if;
  if exists (
    select 1
    from unnest(p_ministry_ids) as requested(id)
    left join public.ministries m
      on m.id = requested.id and m.church_id = p_church_id
    where m.id is null
  ) then raise exception 'invalid ministry'; end if;

  update public.ministry_members
  set active = false
  where church_id = p_church_id
    and user_id = v_user_id
    and role = 'voluntario'
    and not (ministry_id = any(p_ministry_ids));

  insert into public.ministry_members (church_id, ministry_id, user_id, role, active)
  select p_church_id, m.id, v_user_id, 'voluntario', true
  from public.ministries m
  where m.church_id = p_church_id and m.id = any(p_ministry_ids)
  on conflict (ministry_id, user_id) do update set active = true;

  update public.profiles
  set phone = nullif(btrim(p_phone), ''),
      availability = coalesce(p_availability, '{}'::jsonb),
      updated_at = now()
  where id = v_user_id;

  update public.church_members
  set onboarding_completed_at = now()
  where church_id = p_church_id and user_id = v_user_id;
end;
$$;

revoke all on function public.complete_member_onboarding(uuid, uuid[], text, jsonb) from public, anon;
grant execute on function public.complete_member_onboarding(uuid, uuid[], text, jsonb) to authenticated;
