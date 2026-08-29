-- Confirmação de leitura dos avisos do Kids por responsável.
-- Cada aviso mantém um snapshot dos destinatários com conta LUNOR para que
-- uma confirmação esconda o banner apenas para aquela pessoa e dê retorno
-- operacional ao time do Kids.

create table public.child_page_recipients (
  page_id          uuid not null references public.child_pages (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  notified_at      timestamptz not null default now(),
  acknowledged_at  timestamptz,
  primary key (page_id, user_id)
);

create index idx_child_page_recipients_user_pending
  on public.child_page_recipients (user_id, acknowledged_at);

alter table public.child_page_recipients enable row level security;
revoke all on table public.child_page_recipients from anon, authenticated;

-- Atualiza o snapshot de destinatários de um aviso. Só o time do próprio
-- ministério (ou coordenação da igreja) pode executar manualmente.
create or replace function public.refresh_child_page_recipients(p_page_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_kind public.child_page_kind;
  v_checkin uuid;
  v_event uuid;
  v_ministry uuid;
  v_church uuid;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select p.kind, p.checkin_id, p.event_id, p.ministry_id, p.church_id
    into v_kind, v_checkin, v_event, v_ministry, v_church
  from public.child_pages p
  where p.id = p_page_id;

  if not found then
    raise exception 'page_not_found';
  end if;

  if not (public.is_ministry_member(v_ministry) or public.is_church_coord(v_church)) then
    raise exception 'not_authorized';
  end if;

  delete from public.child_page_recipients where page_id = p_page_id;

  if v_kind = 'chamar' then
    insert into public.child_page_recipients (page_id, user_id)
    select distinct p_page_id, g.user_id
    from public.child_checkins c
    join public.child_guardians cg on cg.child_id = c.child_id
    join public.guardians g on g.id = cg.guardian_id
    where c.id = v_checkin
      and g.user_id is not null;
  else
    insert into public.child_page_recipients (page_id, user_id)
    select distinct p_page_id, g.user_id
    from public.child_checkins c
    join public.child_guardians cg on cg.child_id = c.child_id
    join public.guardians g on g.id = cg.guardian_id
    where c.event_id = v_event
      and c.checked_out_at is null
      and g.user_id is not null;
  end if;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.refresh_child_page_recipients(uuid) from public;
grant execute on function public.refresh_child_page_recipients(uuid) to authenticated;

-- Sincronização automática: toda nova chamada recebe destinatários e uma
-- renovação do mesmo chamado (que atualiza created_at) zera a confirmação.
create or replace function public.sync_child_page_recipients()
returns trigger
language plpgsql security definer set search_path = public as $$
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
    where c.event_id = new.event_id
      and c.checked_out_at is null
      and g.user_id is not null;
  end if;

  return new;
end;
$$;

drop trigger if exists child_pages_sync_recipients on public.child_pages;
create trigger child_pages_sync_recipients
after insert or update of created_at on public.child_pages
for each row execute function public.sync_child_page_recipients();

-- Avisos pessoais pendentes para o responsável logado.
create or replace function public.meus_anuncios_infantil(p_church uuid)
returns table (
  page_id uuid,
  code text,
  kind public.child_page_kind,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, k.code, p.kind, p.created_at
  from public.child_page_recipients r
  join public.child_pages p on p.id = r.page_id
  left join public.child_checkins k on k.id = p.checkin_id
  where r.user_id = auth.uid()
    and r.acknowledged_at is null
    and p.resolved_at is null
    and p.church_id = p_church
    and public.is_church_member(p_church)
  order by p.created_at desc
  limit 20;
$$;

revoke all on function public.meus_anuncios_infantil(uuid) from public;
grant execute on function public.meus_anuncios_infantil(uuid) to authenticated;

-- Mantém o anúncio geral por código para quem não é destinatário pessoal.
-- Assim o painel operacional continua existindo, mas o responsável não volta
-- a ver o mesmo aviso genérico depois de clicar em OK.
create or replace function public.anuncios_infantil(p_church uuid)
returns table (code text, kind public.child_page_kind, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select k.code, p.kind, p.created_at
  from public.child_pages p
  left join public.child_checkins k on k.id = p.checkin_id
  where p.church_id = p_church
    and p.resolved_at is null
    and public.is_church_member(p_church)
    and not exists (
      select 1
      from public.child_page_recipients r
      where r.page_id = p.id
        and r.user_id = auth.uid()
    )
  order by p.created_at desc
  limit 20;
$$;

revoke all on function public.anuncios_infantil(uuid) from public;
grant execute on function public.anuncios_infantil(uuid) to authenticated;

-- O próprio destinatário confirma o recebimento. Uma chamada individual é
-- resolvida assim que alguém da família confirma; o fim da sessão só é
-- resolvido globalmente quando todos os destinatários com conta confirmarem.
create or replace function public.acknowledge_child_page(p_page uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_event uuid;
  v_kind public.child_page_kind;
  v_remaining integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.child_page_recipients r
  set acknowledged_at = coalesce(r.acknowledged_at, now())
  where r.page_id = p_page
    and r.user_id = auth.uid();

  if not found then
    raise exception 'not_recipient';
  end if;

  select p.event_id, p.kind
    into v_event, v_kind
  from public.child_pages p
  where p.id = p_page;

  if v_kind = 'chamar' then
    update public.child_pages
    set resolved_at = coalesce(resolved_at, now()),
        resolved_by = coalesce(resolved_by, auth.uid())
    where id = p_page;
  else
    select count(*)::integer
      into v_remaining
    from public.child_page_recipients r
    where r.page_id = p_page
      and r.acknowledged_at is null;

    if v_remaining = 0 then
      update public.child_pages
      set resolved_at = coalesce(resolved_at, now()),
          resolved_by = coalesce(resolved_by, auth.uid())
      where id = p_page;
    end if;
  end if;

  return v_event;
end;
$$;

revoke all on function public.acknowledge_child_page(uuid) from public;
grant execute on function public.acknowledge_child_page(uuid) to authenticated;

-- Status agregado para a tela operacional do Kids. Não retorna nomes nem
-- endpoints: apenas quantos destinatários receberam/confirmaram e o horário.
create or replace function public.child_page_delivery_status(p_event uuid)
returns table (
  page_id uuid,
  checkin_id uuid,
  kind public.child_page_kind,
  recipient_count bigint,
  acknowledged_count bigint,
  last_acknowledged_at timestamptz,
  created_at timestamptz,
  resolved_at timestamptz
)
language sql stable security definer set search_path = public as $$
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
    and (
      public.is_ministry_member(p.ministry_id)
      or public.is_church_coord(p.church_id)
    )
  group by p.id, p.checkin_id, p.kind, p.created_at, p.resolved_at
  order by p.created_at desc
  limit 100;
$$;

revoke all on function public.child_page_delivery_status(uuid) from public;
grant execute on function public.child_page_delivery_status(uuid) to authenticated;

-- Backfill dos avisos ainda ativos para que chamadas já abertas também possam
-- receber confirmação após a implantação.
insert into public.child_page_recipients (page_id, user_id, notified_at)
select distinct p.id, g.user_id, p.created_at
from public.child_pages p
join public.child_checkins c on (
  (p.kind = 'chamar' and c.id = p.checkin_id)
  or
  (p.kind = 'fim_sessao' and c.event_id = p.event_id and c.checked_out_at is null)
)
join public.child_guardians cg on cg.child_id = c.child_id
join public.guardians g on g.id = cg.guardian_id
where p.resolved_at is null
  and g.user_id is not null
on conflict (page_id, user_id) do nothing;
