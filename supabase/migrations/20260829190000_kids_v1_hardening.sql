-- LUNOR Kids V1 hardening
-- Mantem o fluxo operacional ja adotado pelo produto: voluntario ativo do Kids
-- pode cadastrar uma NOVA familia pela RPC atomica, mas nao pode editar fichas.
-- Endurece seed, privilegios, integridade de tenant e chamadas sem quebrar esse fluxo.

-- ---------------------------------------------------------------------------
-- Cadastro atomico: SECURITY DEFINER continua intencional para a recepcao,
-- mas a funcao valida autenticacao, igreja, ministerio e membership ativo.
-- As tabelas seguem com escrita de ficha restrita a lideranca pelas policies.
-- ---------------------------------------------------------------------------
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
  p_guardian_relationship text default null
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

  insert into public.guardians (church_id, ministry_id, full_name, phone)
  values (
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
  uuid, uuid, text, date, text, text, text, text, text, boolean, text, text, text
) from public;
grant execute on function public.create_child_with_primary_guardian(
  uuid, uuid, text, date, text, text, text, text, text, boolean, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed de turmas: interface escondida nao e autorizacao. O banco valida.
-- ---------------------------------------------------------------------------
create or replace function public.seed_child_classes(p_ministry uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_church uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select church_id into v_church
  from public.ministries
  where id = p_ministry;

  if v_church is null then
    raise exception 'ministry_not_found';
  end if;

  if not (
    public.is_church_coord(v_church)
    or public.has_ministry_role(
      p_ministry,
      array['gerente', 'lider']::public.ministry_role[]
    )
  ) then
    raise exception 'not_authorized';
  end if;

  insert into public.child_classes (
    church_id, ministry_id, name, min_age_months, max_age_months, sort_order
  )
  select v_church, p_ministry, x.name, x.min_age, x.max_age, x.sort_order
  from (
    values
      ('Berçário'::text, 0, 35, 1),
      ('Maternal'::text, 36, 59, 2),
      ('Jardim'::text, 60, 83, 3),
      ('Primários'::text, 84, 119, 4),
      ('Juniores'::text, 120, 156, 5)
  ) as x(name, min_age, max_age, sort_order)
  where not exists (
    select 1
    from public.child_classes cc
    where cc.ministry_id = p_ministry
      and lower(cc.name) = lower(x.name)
  );
end;
$$;

revoke all on function public.seed_child_classes(uuid) from public;
grant execute on function public.seed_child_classes(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Integridade forte do check-in entre tenants e setores.
-- ---------------------------------------------------------------------------
create or replace function public.guard_child_checkin_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.ministries m
    where m.id = new.ministry_id and m.church_id = new.church_id
  ) then
    raise exception 'kids_ministry_tenant_mismatch';
  end if;

  if not exists (
    select 1 from public.events e
    where e.id = new.event_id and e.church_id = new.church_id
  ) then
    raise exception 'kids_event_tenant_mismatch';
  end if;

  if not exists (
    select 1 from public.children c
    where c.id = new.child_id
      and c.church_id = new.church_id
      and c.ministry_id = new.ministry_id
      and c.active
  ) then
    raise exception 'kids_child_tenant_mismatch';
  end if;

  if new.class_id is not null and not exists (
    select 1 from public.child_classes cc
    where cc.id = new.class_id
      and cc.church_id = new.church_id
      and cc.ministry_id = new.ministry_id
  ) then
    raise exception 'kids_class_tenant_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists child_checkins_guard_tenant on public.child_checkins;
create trigger child_checkins_guard_tenant
before insert or update of church_id, ministry_id, event_id, child_id, class_id
on public.child_checkins
for each row execute function public.guard_child_checkin_tenant();

-- ---------------------------------------------------------------------------
-- Integridade forte do aviso Kids.
-- ---------------------------------------------------------------------------
create or replace function public.guard_child_page_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.ministries m
    where m.id = new.ministry_id and m.church_id = new.church_id
  ) then
    raise exception 'kids_page_ministry_tenant_mismatch';
  end if;

  if not exists (
    select 1 from public.events e
    where e.id = new.event_id and e.church_id = new.church_id
  ) then
    raise exception 'kids_page_event_tenant_mismatch';
  end if;

  if new.kind = 'chamar' then
    if new.checkin_id is null or not exists (
      select 1
      from public.child_checkins c
      where c.id = new.checkin_id
        and c.church_id = new.church_id
        and c.ministry_id = new.ministry_id
        and c.event_id = new.event_id
        and c.checked_out_at is null
    ) then
      raise exception 'kids_page_checkin_mismatch';
    end if;
  elsif new.kind = 'fim_sessao' and new.checkin_id is not null then
    raise exception 'kids_end_session_must_not_have_checkin';
  end if;

  return new;
end;
$$;

drop trigger if exists child_pages_guard_tenant on public.child_pages;
create trigger child_pages_guard_tenant
before insert or update of church_id, ministry_id, event_id, checkin_id, kind
on public.child_pages
for each row execute function public.guard_child_page_tenant();

-- ---------------------------------------------------------------------------
-- Remove o dedupe legado, que ainda executava UPDATE como o chamador.
-- A partir daqui existe um unico caminho de renovacao, protegido e auditavel.
-- ---------------------------------------------------------------------------
drop trigger if exists dedupe_active_child_call on public.child_pages;
drop function if exists public.dedupe_active_child_call();

-- ---------------------------------------------------------------------------
-- O dedupe de chamadas existentes precisa atualizar internamente a linha ativa.
-- Fazemos essa renovacao em SECURITY DEFINER, mas validando todo o escopo antes
-- do UPDATE. Assim o cliente nao precisa de UPDATE direto em child_pages.
-- ---------------------------------------------------------------------------
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

  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not (
    public.is_ministry_member(new.ministry_id)
    or public.is_church_coord(new.church_id)
  ) then
    raise exception 'not_authorized';
  end if;

  if not exists (
    select 1
    from public.child_checkins c
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
  set
    reason = new.reason,
    created_by = new.created_by,
    created_at = coalesce(new.created_at, now())
  where church_id = new.church_id
    and ministry_id = new.ministry_id
    and event_id = new.event_id
    and checkin_id = new.checkin_id
    and kind = 'chamar'
    and resolved_at is null
  returning id into v_existing_id;

  if v_existing_id is not null then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_child_pages_dedupe_active on public.child_pages;
create trigger trg_child_pages_dedupe_active
before insert on public.child_pages
for each row execute function public.dedupe_active_child_call_before_insert();

-- ---------------------------------------------------------------------------
-- Menor privilegio para child_checkins.
-- Voluntario opera entrada/retirada, mas nao pode DELETE/TRUNCATE.
-- ---------------------------------------------------------------------------
drop policy if exists child_checkins_manage on public.child_checkins;
drop policy if exists child_checkins_insert on public.child_checkins;
drop policy if exists child_checkins_update on public.child_checkins;

create policy child_checkins_insert
on public.child_checkins for insert
with check (
  public.is_ministry_member(ministry_id)
  or public.is_church_coord(church_id)
);

create policy child_checkins_update
on public.child_checkins for update
using (
  public.is_ministry_member(ministry_id)
  or public.is_church_coord(church_id)
)
with check (
  public.is_ministry_member(ministry_id)
  or public.is_church_coord(church_id)
);

revoke all on table public.child_checkins from authenticated;
grant select, insert, update on table public.child_checkins to authenticated;

-- ---------------------------------------------------------------------------
-- Menor privilegio para child_pages.
-- Chamada individual pode ser criada pelo time Kids; encerramento geral exige
-- lideranca/coord. Resolucao/renovacao acontece apenas por funcoes protegidas.
-- ---------------------------------------------------------------------------
drop policy if exists child_pages_manage on public.child_pages;
drop policy if exists child_pages_insert on public.child_pages;

create policy child_pages_insert
on public.child_pages for insert
with check (
  (
    kind = 'chamar'
    and (
      public.is_ministry_member(ministry_id)
      or public.is_church_coord(church_id)
    )
  )
  or
  (
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

revoke all on table public.child_pages from authenticated;
grant select, insert on table public.child_pages to authenticated;
