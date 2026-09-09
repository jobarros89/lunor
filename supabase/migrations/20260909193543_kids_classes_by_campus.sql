-- LUNOR Kids: turmas e recepções passam a ser escopadas por campus.
-- Crianças continuam pertencendo ao ministério/igreja; a turma é escolhida no contexto do check-in.

alter table public.child_classes add column if not exists campus_id uuid;
alter table public.kids_reception_sessions add column if not exists campus_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'child_classes_campus_same_church_fkey') then
    alter table public.child_classes
      add constraint child_classes_campus_same_church_fkey
      foreign key (church_id, campus_id) references public.campuses(church_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'kids_reception_sessions_campus_same_church_fkey') then
    alter table public.kids_reception_sessions
      add constraint kids_reception_sessions_campus_same_church_fkey
      foreign key (church_id, campus_id) references public.campuses(church_id, id);
  end if;
end $$;

update public.child_classes cc
set campus_id = c.id
from public.campuses c
where cc.campus_id is null
  and c.church_id = cc.church_id
  and c.active = true
  and 1 = (select count(*) from public.campuses c2 where c2.church_id = cc.church_id and c2.active = true);

update public.kids_reception_sessions r
set campus_id = c.id
from public.campuses c
where r.campus_id is null
  and c.church_id = r.church_id
  and c.active = true
  and 1 = (select count(*) from public.campuses c2 where c2.church_id = r.church_id and c2.active = true);

-- Estado atual da Rez: as turmas configuradas nesta rodada pertencem à Freguesia.
update public.child_classes cc
set campus_id = c.id,
    name = regexp_replace(cc.name, '\s*-\s*Freguesia\s*$', '', 'i')
from public.churches ch
join public.campuses c on c.church_id = ch.id and lower(c.name) = lower('Freguesia')
where ch.slug = 'rez-church-rio'
  and cc.church_id = ch.id
  and cc.campus_id is null;

-- A recepção standalone aberta durante a validação atual pertence à Freguesia.
update public.kids_reception_sessions r
set campus_id = c.id
from public.churches ch
join public.campuses c on c.church_id = ch.id and lower(c.name) = lower('Freguesia')
where ch.slug = 'rez-church-rio'
  and r.church_id = ch.id
  and r.campus_id is null
  and r.closed_at is null
  and r.event_id is null;

update public.kids_reception_sessions r
set campus_id = e.campus_id
from public.events e
where r.event_id = e.id
  and r.church_id = e.church_id
  and r.campus_id is null
  and e.campus_id is not null;

create index if not exists idx_child_classes_ministry_campus
  on public.child_classes(ministry_id, campus_id, sort_order, name);
create index if not exists kids_reception_sessions_campus_open_idx
  on public.kids_reception_sessions(church_id, ministry_id, campus_id, opened_at desc)
  where closed_at is null;

drop index if exists public.kids_reception_one_open_per_ministry;
create unique index if not exists kids_reception_one_open_per_campus
  on public.kids_reception_sessions(church_id, ministry_id, campus_id)
  where closed_at is null and campus_id is not null;

drop function if exists public.current_kids_reception(uuid, uuid);
create function public.current_kids_reception(p_church uuid, p_ministry uuid)
returns table(
  session_id uuid,
  title text,
  event_id uuid,
  event_title text,
  campus_id uuid,
  campus_name text,
  opened_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.title, r.event_id, e.title, r.campus_id, c.name, r.opened_at
  from public.kids_reception_sessions r
  left join public.events e on e.id = r.event_id
  left join public.campuses c on c.id = r.campus_id and c.church_id = r.church_id
  where r.church_id = p_church
    and r.ministry_id = p_ministry
    and r.closed_at is null
    and public.is_active_ministry_member(p_church, p_ministry)
  order by c.sort_order nulls last, c.name nulls last, r.opened_at desc;
$$;

-- Nova assinatura com campus. A assinatura antiga fica disponível durante a transição.
create or replace function public.open_kids_reception_session(
  p_church uuid,
  p_ministry uuid,
  p_title text,
  p_event uuid,
  p_campus uuid
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
  v_event_campus uuid;
  v_campus uuid;
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;

  if not (
    public.is_church_coord(p_church)
    or public.has_ministry_role(p_ministry, array['gerente', 'lider']::public.ministry_role[])
    or (p_event is not null and public.can_operate_kids(p_church, p_ministry, p_event))
  ) then
    raise exception 'not_allowed';
  end if;

  if not exists (
    select 1 from public.ministries m where m.id = p_ministry and m.church_id = p_church
  ) then
    raise exception 'invalid_reception_context';
  end if;

  if p_event is not null then
    select e.campus_id into v_event_campus
    from public.events e where e.id = p_event and e.church_id = p_church;
    if not found then raise exception 'invalid_reception_context'; end if;
    if v_event_campus is not null and p_campus is not null and v_event_campus <> p_campus then
      raise exception 'campus_mismatch';
    end if;
  end if;

  v_campus := coalesce(v_event_campus, p_campus);
  if v_campus is null then raise exception 'campus_required'; end if;

  if not exists (
    select 1 from public.campuses c
    where c.id = v_campus and c.church_id = p_church and c.active = true
  ) then
    raise exception 'invalid_campus';
  end if;

  select * into v_existing
  from public.kids_reception_sessions r
  where r.church_id = p_church
    and r.ministry_id = p_ministry
    and r.campus_id = v_campus
    and r.closed_at is null
  order by r.opened_at desc
  limit 1;

  if found then
    if p_event is not null and v_existing.event_id = p_event then return v_existing.id; end if;
    raise exception 'reception_already_open';
  end if;

  v_title := nullif(btrim(coalesce(p_title, '')), '');
  if v_title is null and p_event is not null then
    select e.title into v_title from public.events e where e.id = p_event;
  end if;
  v_title := coalesce(v_title, 'Recepção Kids');

  insert into public.kids_reception_sessions(
    church_id, ministry_id, event_id, campus_id, title, opened_at, opened_by
  ) values (
    p_church, p_ministry, p_event, v_campus, v_title, now(), auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;
