-- Modo Culto: checklist operacional simples por evento.
--
-- Os itens exibidos continuam definidos na aplicação nesta primeira versão.
-- A tabela persiste apenas o estado marcado/desmarcado por evento, evitando
-- automações, templates e configurações avançadas nesta etapa.

create table public.event_cult_checks (
  church_id   uuid not null references public.churches(id) on delete cascade,
  event_id    uuid not null,
  check_key   text not null check (char_length(btrim(check_key)) between 1 and 80),
  completed   boolean not null default false,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (event_id, check_key),
  constraint event_cult_checks_event_fkey
    foreign key (church_id, event_id)
    references public.events(church_id, id)
    on delete cascade
);

create index event_cult_checks_church_event_idx
  on public.event_cult_checks(church_id, event_id);

create trigger event_cult_checks_updated_at
  before update on public.event_cult_checks
  for each row execute function public.set_updated_at();

-- O checklist faz parte da operação do culto. Membros da igreja podem ler.
alter table public.event_cult_checks enable row level security;

create policy event_cult_checks_select on public.event_cult_checks
  for select
  to authenticated
  using (public.is_church_member(church_id));

-- Coordenadores podem atualizar qualquer checklist. Líderes/gestores podem
-- atualizar quando administram algum time vinculado ao evento, respeitando
-- campus e a nova estrutura de permissões.
create policy event_cult_checks_insert on public.event_cult_checks
  for insert
  to authenticated
  with check (
    public.is_church_coord(church_id)
    or exists (
      select 1
      from public.events event
      where event.id = event_cult_checks.event_id
        and event.church_id = event_cult_checks.church_id
        and event.ministry_id is not null
        and public.can_manage_ministry_event(event.ministry_id, event.id)
    )
    or exists (
      select 1
      from public.event_ministries linked
      where linked.event_id = event_cult_checks.event_id
        and linked.church_id = event_cult_checks.church_id
        and public.can_manage_ministry_event(linked.ministry_id, linked.event_id)
    )
  );

create policy event_cult_checks_update on public.event_cult_checks
  for update
  to authenticated
  using (
    public.is_church_coord(church_id)
    or exists (
      select 1
      from public.events event
      where event.id = event_cult_checks.event_id
        and event.church_id = event_cult_checks.church_id
        and event.ministry_id is not null
        and public.can_manage_ministry_event(event.ministry_id, event.id)
    )
    or exists (
      select 1
      from public.event_ministries linked
      where linked.event_id = event_cult_checks.event_id
        and linked.church_id = event_cult_checks.church_id
        and public.can_manage_ministry_event(linked.ministry_id, linked.event_id)
    )
  )
  with check (
    public.is_church_coord(church_id)
    or exists (
      select 1
      from public.events event
      where event.id = event_cult_checks.event_id
        and event.church_id = event_cult_checks.church_id
        and event.ministry_id is not null
        and public.can_manage_ministry_event(event.ministry_id, event.id)
    )
    or exists (
      select 1
      from public.event_ministries linked
      where linked.event_id = event_cult_checks.event_id
        and linked.church_id = event_cult_checks.church_id
        and public.can_manage_ministry_event(linked.ministry_id, linked.event_id)
    )
  );

grant select, insert, update on public.event_cult_checks to authenticated;
