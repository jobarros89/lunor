-- Recepção Kids como sessão operacional própria.
-- O culto/evento passa a ser apenas um contexto opcional. A recepção permanece
-- aberta até uma ação explícita de encerramento.

alter table public.kids_reception_sessions
  add column if not exists title text;

update public.kids_reception_sessions r
set title = coalesce(
  nullif(r.title, ''),
  (select e.title from public.events e where e.id = r.event_id),
  'Recepção Kids'
)
where r.title is null or btrim(r.title) = '';

alter table public.kids_reception_sessions
  alter column title set default 'Recepção Kids',
  alter column title set not null,
  alter column event_id drop not null;

-- Apenas uma recepção pode ficar aberta por ministério.
create unique index if not exists kids_reception_one_open_per_ministry
  on public.kids_reception_sessions (church_id, ministry_id)
  where closed_at is null;

-- O histórico operacional passa a apontar para a sessão de recepção.
alter table public.child_checkins
  add column if not exists reception_session_id uuid
    references public.kids_reception_sessions(id) on delete set null;

alter table public.child_pages
  add column if not exists reception_session_id uuid
    references public.kids_reception_sessions(id) on delete set null;

-- Vincula registros atuais/legados quando existe uma sessão para o mesmo culto.
update public.child_checkins c
set reception_session_id = r.id
from public.kids_reception_sessions r
where c.reception_session_id is null
  and c.event_id is not null
  and r.event_id = c.event_id
  and r.church_id = c.church_id
  and r.ministry_id = c.ministry_id;

update public.child_pages p
set reception_session_id = r.id
from public.kids_reception_sessions r
where p.reception_session_id is null
  and p.event_id is not null
  and r.event_id = p.event_id
  and r.church_id = p.church_id
  and r.ministry_id = p.ministry_id;

alter table public.child_checkins alter column event_id drop not null;
alter table public.child_pages alter column event_id drop not null;

create index if not exists child_checkins_reception_session_idx
  on public.child_checkins (reception_session_id, checked_in_at desc);
create unique index if not exists child_checkins_session_code_key
  on public.child_checkins (reception_session_id, code)
  where reception_session_id is not null;
create unique index if not exists child_checkins_one_active_per_child_session
  on public.child_checkins (reception_session_id, child_id)
  where reception_session_id is not null and checked_out_at is null;
create index if not exists child_pages_reception_session_idx
  on public.child_pages (reception_session_id, created_at desc);

-- Permissão operacional de uma recepção viva.
create or replace function public.can_operate_kids_reception(
  p_church uuid,
  p_ministry uuid,
  p_session uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.kids_reception_sessions r
    where r.id = p_session
      and r.church_id = p_church
      and r.ministry_id = p_ministry
      and r.closed_at is null
      and (
        public.is_church_coord(p_church)
        or public.has_ministry_role(
          p_ministry,
          array['gerente', 'lider']::public.ministry_role[]
        )
        or (
          r.event_id is not null
          and public.can_operate_kids(p_church, p_ministry, r.event_id)
        )
      )
  );
$$;

-- Abertura explícita: o evento é opcional e serve apenas como contexto.
create or replace function public.open_kids_reception_session(
  p_church uuid,
  p_ministry uuid,
  p_title text default 'Recepção Kids',
  p_event uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.kids_reception_sessions%rowtype;
  v_id uuid;
  v_title text;
begin
  if auth.uid() is null then
    raise exception 'not_allowed';
  end if;

  if not (
    public.is_church_coord(p_church)
    or public.has_ministry_role(
      p_ministry,
      array['gerente', 'lider']::public.ministry_role[]
    )
    or (
      p_event is not null
      and public.can_operate_kids(p_church, p_ministry, p_event)
    )
  ) then
    raise exception 'not_allowed';
  end if;

  if not exists (
    select 1 from public.ministries m
    where m.id = p_ministry and m.church_id = p_church
  ) then
    raise exception 'invalid_reception_context';
  end if;

  if p_event is not null and not exists (
    select 1 from public.events e
    where e.id = p_event and e.church_id = p_church
  ) then
    raise exception 'invalid_reception_context';
  end if;

  select * into v_existing
  from public.kids_reception_sessions r
  where r.church_id = p_church
    and r.ministry_id = p_ministry
    and r.closed_at is null
  order by r.opened_at desc
  limit 1;

  if found then
    if p_event is not null and v_existing.event_id = p_event then
      return v_existing.id;
    end if;
    raise exception 'reception_already_open';
  end if;

  v_title := nullif(btrim(coalesce(p_title, '')), '');
  if v_title is null and p_event is not null then
    select e.title into v_title from public.events e where e.id = p_event;
  end if;
  v_title := coalesce(v_title, 'Recepção Kids');

  insert into public.kids_reception_sessions (
    church_id, ministry_id, event_id, title, opened_at, opened_by
  ) values (
    p_church, p_ministry, p_event, v_title, now(), auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

-- Compatibilidade com as rotas atuais ligadas a um culto.
create or replace function public.open_kids_reception(
  p_church uuid,
  p_ministry uuid,
  p_event uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_id uuid;
begin
  select e.title into v_title
  from public.events e
  where e.id = p_event and e.church_id = p_church;

  v_id := public.open_kids_reception_session(
    p_church,
    p_ministry,
    coalesce(v_title, 'Recepção Kids'),
    p_event
  );
  return v_id is not null;
end;
$$;

create or replace function public.close_kids_reception(
  p_church uuid,
  p_ministry uuid,
  p_session uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not (
    public.is_church_coord(p_church)
    or public.has_ministry_role(
      p_ministry,
      array['gerente', 'lider']::public.ministry_role[]
    )
  ) then
    raise exception 'not_allowed';
  end if;

  if not exists (
    select 1
    from public.kids_reception_sessions r
    where r.id = p_session
      and r.church_id = p_church
      and r.ministry_id = p_ministry
      and r.closed_at is null
  ) then
    raise exception 'reception_not_open';
  end if;

  if exists (
    select 1
    from public.child_checkins c
    where c.reception_session_id = p_session
      and c.checked_out_at is null
  ) then
    raise exception 'children_still_present';
  end if;

  update public.kids_reception_sessions
  set closed_at = now(), closed_by = auth.uid()
  where id = p_session
    and church_id = p_church
    and ministry_id = p_ministry
    and closed_at is null;

  update public.child_pages
  set resolved_at = coalesce(resolved_at, now()),
      resolved_by = coalesce(resolved_by, auth.uid())
  where reception_session_id = p_session
    and resolved_at is null;

  return true;
end;
$$;

-- A recepção não expira pelo relógio do culto: só encerra explicitamente.
create or replace function public.is_kids_reception_open(
  p_church uuid,
  p_ministry uuid,
  p_event uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.kids_reception_sessions r
    where r.church_id = p_church
      and r.ministry_id = p_ministry
      and r.event_id = p_event
      and r.closed_at is null
  );
$$;

create or replace function public.current_kids_reception(
  p_church uuid,
  p_ministry uuid
)
returns table(
  session_id uuid,
  title text,
  event_id uuid,
  event_title text,
  opened_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.title, r.event_id, e.title, r.opened_at
  from public.kids_reception_sessions r
  left join public.events e on e.id = r.event_id
  where r.church_id = p_church
    and r.ministry_id = p_ministry
    and r.closed_at is null
    and (
      public.is_church_coord(p_church)
      or public.has_ministry_role(
        p_ministry,
        array['gerente', 'lider']::public.ministry_role[]
      )
      or (
        r.event_id is not null
        and public.can_operate_kids(p_church, p_ministry, r.event_id)
      )
    )
  order by r.opened_at desc
  limit 1;
$$;

create or replace function public.guardian_current_kids_reception(
  p_church uuid,
  p_ministry uuid
)
returns table(
  session_id uuid,
  title text,
  event_id uuid,
  event_title text,
  opened_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.title, r.event_id, e.title, r.opened_at
  from public.kids_reception_sessions r
  left join public.events e on e.id = r.event_id
  where r.church_id = p_church
    and r.ministry_id = p_ministry
    and r.closed_at is null
    and exists (
      select 1
      from public.guardians g
      where g.church_id = p_church
        and g.ministry_id = p_ministry
        and g.user_id = auth.uid()
    )
  order by r.opened_at desc
  limit 1;
$$;

-- Compatibilidade: só há "evento atual" para a família quando a recepção viva
-- estiver vinculada a um evento.
create or replace function public.guardian_current_kids_event(
  p_church uuid,
  p_ministry uuid
)
returns table(
  id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.title, e.starts_at, e.ends_at
  from public.kids_reception_sessions r
  join public.events e on e.id = r.event_id
  where r.church_id = p_church
    and r.ministry_id = p_ministry
    and r.closed_at is null
    and exists (
      select 1
      from public.guardians g
      where g.church_id = p_church
        and g.ministry_id = p_ministry
        and g.user_id = auth.uid()
    )
  order by r.opened_at desc
  limit 1;
$$;

create or replace function public.guardian_checkin_child_v2(
  p_church uuid,
  p_ministry uuid,
  p_session uuid,
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
  v_event uuid;
begin
  if auth.uid() is null or not public.is_guardian_of(p_child) then
    raise exception 'not_allowed';
  end if;

  select r.event_id into v_event
  from public.kids_reception_sessions r
  where r.id = p_session
    and r.church_id = p_church
    and r.ministry_id = p_ministry
    and r.closed_at is null;

  if not found or not exists (
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
    where c.reception_session_id = p_session
      and c.child_id = p_child
      and c.checked_out_at is null
  ) then
    raise exception 'already_checked_in';
  end if;

  for i in 1..20 loop
    v_code := (100 + floor(random() * 900))::integer::text;
    begin
      insert into public.child_checkins (
        church_id,
        ministry_id,
        reception_session_id,
        event_id,
        class_id,
        child_id,
        code,
        checked_in_by
      ) values (
        p_church,
        p_ministry,
        p_session,
        v_event,
        p_class,
        p_child,
        v_code,
        auth.uid()
      ) returning id into v_checkin;
      return v_checkin;
    exception when unique_violation then
      null;
    end;
  end loop;

  raise exception 'code_generation_failed';
end;
$$;

-- Mantém o RPC antigo, mas exige uma recepção explicitamente aberta.
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
  v_session uuid;
begin
  select r.id into v_session
  from public.kids_reception_sessions r
  where r.church_id = p_church
    and r.ministry_id = p_ministry
    and r.event_id = p_event
    and r.closed_at is null
  order by r.opened_at desc
  limit 1;

  if v_session is null then
    raise exception 'operation_not_available';
  end if;

  return public.guardian_checkin_child_v2(
    p_church, p_ministry, v_session, p_child, p_class
  );
end;
$$;

-- Validação de tenant agora aceita sessão sem culto.
create or replace function public.guard_child_checkin_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_event uuid;
begin
  if not exists (
    select 1 from public.ministries m
    where m.id = new.ministry_id and m.church_id = new.church_id
  ) then
    raise exception 'kids_ministry_tenant_mismatch';
  end if;

  if new.reception_session_id is not null then
    select r.event_id into v_session_event
    from public.kids_reception_sessions r
    where r.id = new.reception_session_id
      and r.church_id = new.church_id
      and r.ministry_id = new.ministry_id;
    if not found then
      raise exception 'kids_reception_tenant_mismatch';
    end if;
    if new.event_id is null then
      new.event_id := v_session_event;
    elsif v_session_event is distinct from new.event_id then
      raise exception 'kids_reception_event_mismatch';
    end if;
  elsif new.event_id is null then
    raise exception 'kids_operation_context_missing';
  end if;

  if new.event_id is not null and not exists (
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

create or replace function public.guard_child_page_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_event uuid;
begin
  if not exists (
    select 1 from public.ministries m
    where m.id = new.ministry_id and m.church_id = new.church_id
  ) then
    raise exception 'kids_page_ministry_tenant_mismatch';
  end if;

  if new.reception_session_id is not null then
    select r.event_id into v_session_event
    from public.kids_reception_sessions r
    where r.id = new.reception_session_id
      and r.church_id = new.church_id
      and r.ministry_id = new.ministry_id;
    if not found then
      raise exception 'kids_page_reception_tenant_mismatch';
    end if;
    if new.event_id is null then
      new.event_id := v_session_event;
    elsif v_session_event is distinct from new.event_id then
      raise exception 'kids_page_reception_event_mismatch';
    end if;
  elsif new.event_id is null then
    raise exception 'kids_page_context_missing';
  end if;

  if new.event_id is not null and not exists (
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
        and (
          (new.reception_session_id is not null and c.reception_session_id = new.reception_session_id)
          or (
            new.reception_session_id is null
            and new.event_id is not null
            and c.event_id = new.event_id
          )
        )
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

create or replace function public.sync_child_page_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.child_page_recipients where page_id = new.id;

  if new.kind = 'chamar' then
    insert into public.child_page_recipients (page_id, user_id, notified_at)
    select distinct new.id, g.user_id, new.created_at
    from public.child_checkins c
    join public.child_guardians cg on cg.child_id = c.child_id
    join public.guardians g on g.id = cg.guardian_id
    where c.id = new.checkin_id
      and g.user_id is not null;
  else
    insert into public.child_page_recipients (page_id, user_id, notified_at)
    select distinct new.id, g.user_id, new.created_at
    from public.child_checkins c
    join public.child_guardians cg on cg.child_id = c.child_id
    join public.guardians g on g.id = cg.guardian_id
    where (
        (new.reception_session_id is not null and c.reception_session_id = new.reception_session_id)
        or (
          new.reception_session_id is null
          and new.event_id is not null
          and c.event_id = new.event_id
        )
      )
      and c.checked_out_at is null
      and g.user_id is not null;
  end if;

  return new;
end;
$$;

-- Políticas passam a reconhecer a sessão viva.
drop policy if exists child_checkins_insert on public.child_checkins;
create policy child_checkins_insert on public.child_checkins
for insert to authenticated
with check (
  (
    reception_session_id is not null
    and public.can_operate_kids_reception(church_id, ministry_id, reception_session_id)
  )
  or (
    reception_session_id is null
    and event_id is not null
    and public.can_operate_kids(church_id, ministry_id, event_id)
  )
);

drop policy if exists child_checkins_select on public.child_checkins;
create policy child_checkins_select on public.child_checkins
for select to authenticated
using (
  public.is_guardian_of(child_id)
  or (
    reception_session_id is not null
    and public.can_operate_kids_reception(church_id, ministry_id, reception_session_id)
  )
  or (
    reception_session_id is null
    and event_id is not null
    and public.can_operate_kids(church_id, ministry_id, event_id)
  )
);

drop policy if exists child_checkins_update on public.child_checkins;
create policy child_checkins_update on public.child_checkins
for update to authenticated
using (
  (
    reception_session_id is not null
    and public.can_operate_kids_reception(church_id, ministry_id, reception_session_id)
  )
  or (
    reception_session_id is null
    and event_id is not null
    and public.can_operate_kids(church_id, ministry_id, event_id)
  )
)
with check (
  (
    reception_session_id is not null
    and public.can_operate_kids_reception(church_id, ministry_id, reception_session_id)
  )
  or (
    reception_session_id is null
    and event_id is not null
    and public.can_operate_kids(church_id, ministry_id, event_id)
  )
);

drop policy if exists child_pages_insert on public.child_pages;
create policy child_pages_insert on public.child_pages
for insert to authenticated
with check (
  (
    kind = 'chamar'::public.child_page_kind
    and (
      (
        reception_session_id is not null
        and public.can_operate_kids_reception(church_id, ministry_id, reception_session_id)
      )
      or (
        reception_session_id is null
        and event_id is not null
        and public.can_operate_kids(church_id, ministry_id, event_id)
      )
    )
  )
  or (
    kind = 'fim_sessao'::public.child_page_kind
    and (
      public.is_church_coord(church_id)
      or public.has_ministry_role(
        ministry_id,
        array['gerente', 'lider']::public.ministry_role[]
      )
    )
  )
);

drop policy if exists child_pages_select on public.child_pages;
create policy child_pages_select on public.child_pages
for select to authenticated
using (
  (
    reception_session_id is not null
    and public.can_operate_kids_reception(church_id, ministry_id, reception_session_id)
  )
  or (
    reception_session_id is null
    and event_id is not null
    and public.can_operate_kids(church_id, ministry_id, event_id)
  )
);

create or replace function public.child_page_delivery_status_session(p_session uuid)
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
  where p.reception_session_id = p_session
    and public.can_operate_kids_reception(
      p.church_id,
      p.ministry_id,
      p.reception_session_id
    )
  group by p.id, p.checkin_id, p.kind, p.created_at, p.resolved_at
  order by p.created_at desc
  limit 100;
$$;

revoke all on function public.can_operate_kids_reception(uuid, uuid, uuid) from public;
revoke all on function public.open_kids_reception_session(uuid, uuid, text, uuid) from public;
revoke all on function public.close_kids_reception(uuid, uuid, uuid) from public;
revoke all on function public.current_kids_reception(uuid, uuid) from public;
revoke all on function public.guardian_current_kids_reception(uuid, uuid) from public;
revoke all on function public.guardian_checkin_child_v2(uuid, uuid, uuid, uuid, uuid) from public;
revoke all on function public.child_page_delivery_status_session(uuid) from public;

grant execute on function public.can_operate_kids_reception(uuid, uuid, uuid) to authenticated;
grant execute on function public.open_kids_reception_session(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.close_kids_reception(uuid, uuid, uuid) to authenticated;
grant execute on function public.current_kids_reception(uuid, uuid) to authenticated;
grant execute on function public.guardian_current_kids_reception(uuid, uuid) to authenticated;
grant execute on function public.guardian_checkin_child_v2(uuid, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.child_page_delivery_status_session(uuid) to authenticated;