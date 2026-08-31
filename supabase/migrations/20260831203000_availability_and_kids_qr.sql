-- ============================================================
-- LUNOR — Disponibilidade de voluntários + QR de retirada Kids
-- ============================================================

-- ---------- Kids: token opaco para localizar um check-in ----------
-- O token NÃO autoriza a retirada. Ele apenas localiza o check-in; RLS +
-- confirmação de responsável autorizado continuam sendo obrigatórios.
alter table public.child_checkins
  add column if not exists pickup_qr_token text not null
  default replace(gen_random_uuid()::text, '-', '');

create unique index if not exists idx_child_checkins_pickup_qr_token
  on public.child_checkins (pickup_qr_token);

-- ---------- Solicitações de disponibilidade ----------
create table if not exists public.availability_requests (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  ministry_id uuid not null references public.ministries (id) on delete cascade,
  title       text not null check (char_length(title) between 2 and 120),
  respond_by  timestamptz,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  closed_at   timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_availability_requests_ministry
  on public.availability_requests (ministry_id, created_at desc);

create table if not exists public.availability_request_events (
  request_id  uuid not null references public.availability_requests (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade,
  church_id   uuid not null references public.churches (id) on delete cascade,
  ministry_id uuid not null references public.ministries (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (request_id, event_id)
);

create index if not exists idx_availability_request_events_event
  on public.availability_request_events (event_id, ministry_id);

-- Uma resposta corrente por culto/evento e ministério. Serve tanto para
-- solicitação do líder quanto para envio espontâneo do voluntário.
create table if not exists public.member_availability (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  ministry_id uuid not null references public.ministries (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  request_id  uuid references public.availability_requests (id) on delete set null,
  status      text not null check (status in ('available', 'unavailable', 'maybe')),
  source      text not null default 'volunteer' check (source in ('volunteer', 'leader_request')),
  note        text check (note is null or char_length(note) <= 200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (ministry_id, event_id, user_id)
);

create index if not exists idx_member_availability_ministry_event
  on public.member_availability (ministry_id, event_id, status);
create index if not exists idx_member_availability_user
  on public.member_availability (user_id, event_id);

create trigger member_availability_updated_at
  before update on public.member_availability
  for each row execute function public.set_updated_at();

-- ---------- Integridade multi-tenant ----------
create or replace function public.guard_availability_request_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_request public.availability_requests%rowtype;
  v_event public.events%rowtype;
begin
  select * into v_request from public.availability_requests where id = new.request_id;
  select * into v_event from public.events where id = new.event_id;

  if v_request.id is null or v_event.id is null then
    raise exception 'availability_reference_not_found';
  end if;

  if new.church_id <> v_request.church_id
     or new.ministry_id <> v_request.ministry_id
     or v_event.church_id <> new.church_id
     or (v_event.ministry_id is not null and v_event.ministry_id <> new.ministry_id) then
    raise exception 'availability_tenant_mismatch';
  end if;

  return new;
end;
$$;

create trigger availability_request_events_integrity
  before insert or update on public.availability_request_events
  for each row execute function public.guard_availability_request_event();

create or replace function public.guard_member_availability()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_event public.events%rowtype;
  v_request public.availability_requests%rowtype;
begin
  select * into v_event from public.events where id = new.event_id;
  if v_event.id is null
     or v_event.church_id <> new.church_id
     or (v_event.ministry_id is not null and v_event.ministry_id <> new.ministry_id) then
    raise exception 'availability_event_mismatch';
  end if;

  if not exists (
    select 1 from public.ministry_members mm
    where mm.church_id = new.church_id
      and mm.ministry_id = new.ministry_id
      and mm.user_id = new.user_id
      and mm.active
  ) and not public.is_church_coord(new.church_id) then
    raise exception 'availability_not_ministry_member';
  end if;

  if new.request_id is not null then
    select * into v_request from public.availability_requests where id = new.request_id;
    if v_request.id is null
       or v_request.church_id <> new.church_id
       or v_request.ministry_id <> new.ministry_id
       or not exists (
         select 1 from public.availability_request_events are
         where are.request_id = new.request_id and are.event_id = new.event_id
       ) then
      raise exception 'availability_request_mismatch';
    end if;
    new.source := 'leader_request';
  end if;

  return new;
end;
$$;

create trigger member_availability_integrity
  before insert or update on public.member_availability
  for each row execute function public.guard_member_availability();

-- ---------- RPC atômica: líder solicita disponibilidade ----------
create or replace function public.create_availability_request(
  p_church uuid,
  p_ministry uuid,
  p_title text,
  p_event_ids uuid[],
  p_respond_by timestamptz default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_request uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not (
    public.is_church_coord(p_church)
    or public.has_ministry_role(p_ministry, array['gerente', 'lider']::public.ministry_role[])
  ) then
    raise exception 'not_allowed';
  end if;

  if not exists (
    select 1 from public.ministries m where m.id = p_ministry and m.church_id = p_church
  ) then
    raise exception 'invalid_ministry';
  end if;

  if coalesce(array_length(p_event_ids, 1), 0) = 0 then
    raise exception 'events_required';
  end if;

  if exists (
    select 1
    from unnest(p_event_ids) as selected(event_id)
    left join public.events e on e.id = selected.event_id
    where e.id is null
       or e.church_id <> p_church
       or (e.ministry_id is not null and e.ministry_id <> p_ministry)
  ) then
    raise exception 'invalid_event';
  end if;

  insert into public.availability_requests (
    church_id, ministry_id, title, respond_by, created_by
  ) values (
    p_church, p_ministry, trim(p_title), p_respond_by, auth.uid()
  ) returning id into v_request;

  insert into public.availability_request_events (
    request_id, event_id, church_id, ministry_id
  )
  select v_request, event_id, p_church, p_ministry
  from (select distinct unnest(p_event_ids) as event_id) selected;

  return v_request;
end;
$$;

grant execute on function public.create_availability_request(uuid, uuid, text, uuid[], timestamptz)
  to authenticated;

-- ---------- RLS ----------
alter table public.availability_requests enable row level security;
alter table public.availability_request_events enable row level security;
alter table public.member_availability enable row level security;

create policy availability_requests_select on public.availability_requests
  for select using (
    public.is_ministry_member(ministry_id) or public.is_church_coord(church_id)
  );

create policy availability_requests_manage on public.availability_requests
  for all using (
    public.is_church_coord(church_id)
    or public.has_ministry_role(ministry_id, array['gerente', 'lider']::public.ministry_role[])
  ) with check (
    public.is_church_coord(church_id)
    or public.has_ministry_role(ministry_id, array['gerente', 'lider']::public.ministry_role[])
  );

create policy availability_request_events_select on public.availability_request_events
  for select using (
    public.is_ministry_member(ministry_id) or public.is_church_coord(church_id)
  );

create policy availability_request_events_manage on public.availability_request_events
  for all using (
    public.is_church_coord(church_id)
    or public.has_ministry_role(ministry_id, array['gerente', 'lider']::public.ministry_role[])
  ) with check (
    public.is_church_coord(church_id)
    or public.has_ministry_role(ministry_id, array['gerente', 'lider']::public.ministry_role[])
  );

create policy member_availability_select on public.member_availability
  for select using (
    user_id = auth.uid()
    or public.is_church_coord(church_id)
    or public.has_ministry_role(ministry_id, array['gerente', 'lider']::public.ministry_role[])
  );

create policy member_availability_self_insert on public.member_availability
  for insert with check (
    user_id = auth.uid() and public.is_ministry_member(ministry_id)
  );

create policy member_availability_self_update on public.member_availability
  for update using (
    user_id = auth.uid() and public.is_ministry_member(ministry_id)
  ) with check (
    user_id = auth.uid() and public.is_ministry_member(ministry_id)
  );

create policy member_availability_self_delete on public.member_availability
  for delete using (
    user_id = auth.uid() and public.is_ministry_member(ministry_id)
  );

-- ---------- Auditoria ----------
create trigger audit_availability_requests
  after insert or update or delete on public.availability_requests
  for each row execute function public.log_audit();
create trigger audit_member_availability
  after insert or update or delete on public.member_availability
  for each row execute function public.log_audit();
