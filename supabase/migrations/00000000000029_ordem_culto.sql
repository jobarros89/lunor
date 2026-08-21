-- Ordem do Culto: sequência operacional de um evento.
--
-- Esta estrutura é independente do repertório musical (setlist_items). Um item
-- de louvor pode descrever um bloco do culto sem duplicar músicas ou setlists.

create type public.service_item_type as enum (
  'WORSHIP',
  'SPEAKING',
  'MEDIA',
  'OTHER'
);

-- Permite que a FK composta abaixo garanta que evento e item são da mesma
-- igreja sem depender de trigger.
alter table public.events
  add constraint events_church_id_id_key unique (church_id, id);

create table public.service_items (
  id               uuid primary key default gen_random_uuid(),
  church_id        uuid not null references public.churches (id) on delete cascade,
  event_id         uuid not null,
  type             public.service_item_type not null default 'OTHER',
  title            text not null
                   check (char_length(btrim(title)) between 1 and 160),
  notes            text,
  duration_minutes integer not null default 0
                   check (duration_minutes between 0 and 1440),
  position         integer not null check (position >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint service_items_event_fkey
    foreign key (church_id, event_id)
    references public.events (church_id, id)
    on delete cascade,
  constraint service_items_event_position_key
    unique (church_id, event_id, position)
);

create trigger service_items_updated_at
  before update on public.service_items
  for each row execute function public.set_updated_at();

alter table public.service_items enable row level security;

-- A ordem é informação operacional do evento: membros da igreja podem ler.
create policy service_items_select on public.service_items
  for select
  to authenticated
  using (public.is_church_member(church_id));

-- A escrita acompanha exatamente a gestão de events/assignments.
create policy service_items_write on public.service_items
  for all
  to authenticated
  using (public.is_church_leader(church_id))
  with check (public.is_church_leader(church_id));
