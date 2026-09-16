-- Evolui a integração WhatsApp existente para suportar múltiplos providers
-- sem quebrar os registros já gravados pela Meta Cloud API.

alter table public.whatsapp_messages
  add column if not exists provider text not null default 'meta',
  add column if not exists provider_instance text;

alter table public.whatsapp_messages
  alter column template_name drop not null;

alter table public.whatsapp_messages
  drop constraint if exists whatsapp_messages_message_kind_check;

alter table public.whatsapp_messages
  add constraint whatsapp_messages_message_kind_check
  check (message_kind in ('assignment_published', 'reminder_d1', 'availability_request'));

alter table public.whatsapp_messages
  drop constraint if exists whatsapp_messages_provider_check;

alter table public.whatsapp_messages
  add constraint whatsapp_messages_provider_check
  check (provider in ('meta', 'evolution'));

create index if not exists idx_whatsapp_messages_provider_status
  on public.whatsapp_messages(provider, status, created_at desc);

comment on column public.whatsapp_messages.provider is
  'Gateway usado no envio: meta (Cloud API oficial) ou evolution (Evolution API).';
comment on column public.whatsapp_messages.provider_instance is
  'Identificador/nome da instância no provider, quando aplicável.';

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete set null,
  provider text not null check (provider in ('meta', 'evolution')),
  provider_instance text not null,
  phone_number text,
  status text not null default 'disconnected'
    check (status in ('disconnected', 'connecting', 'connected', 'error')),
  connected_at timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_connections_provider_instance_unique unique (provider, provider_instance)
);

create index if not exists idx_whatsapp_connections_church
  on public.whatsapp_connections(church_id, provider, status);

-- Uma igreja possui no máximo uma conexão geral por provider. Se futuramente
-- um campus ganhar número próprio, ele também terá no máximo uma conexão por provider.
create unique index if not exists uq_whatsapp_connections_church_provider
  on public.whatsapp_connections(church_id, provider)
  where campus_id is null;
create unique index if not exists uq_whatsapp_connections_campus_provider
  on public.whatsapp_connections(church_id, campus_id, provider)
  where campus_id is not null;

alter table public.whatsapp_connections enable row level security;

drop policy if exists whatsapp_connections_select on public.whatsapp_connections;
create policy whatsapp_connections_select
  on public.whatsapp_connections
  for select
  using (
    public.is_church_leader(church_id)
    or public.is_platform_admin()
  );

-- Conexões são mantidas apenas pelo backend confiável. A interface pode ler
-- o estado, mas nunca criar/trocar instâncias diretamente do navegador.
revoke insert, update, delete on public.whatsapp_connections from anon, authenticated;
grant select on public.whatsapp_connections to authenticated;
grant all on public.whatsapp_connections to service_role;
