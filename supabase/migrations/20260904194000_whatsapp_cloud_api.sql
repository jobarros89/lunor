-- WhatsApp Business Platform / Meta Cloud API
-- Histórico por tenant, idempotência de envio e deduplicação de webhooks.

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  ministry_id uuid references public.ministries(id) on delete set null,
  assignment_id uuid references public.assignments(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  phone_e164 text not null,
  message_kind text not null check (message_kind in ('assignment_published', 'reminder_d1')),
  template_name text not null,
  wa_message_id text unique,
  inbound_message_id text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'read', 'confirmed', 'declined', 'failed')),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  responded_at timestamptz,
  failed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_messages_assignment_kind_unique unique (assignment_id, message_kind)
);

create index if not exists idx_whatsapp_messages_church_event
  on public.whatsapp_messages(church_id, event_id);
create index if not exists idx_whatsapp_messages_assignment
  on public.whatsapp_messages(assignment_id);
create index if not exists idx_whatsapp_messages_user
  on public.whatsapp_messages(user_id);

create table if not exists public.whatsapp_webhook_events (
  event_key text primary key,
  source_key text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_whatsapp_webhook_source_received
  on public.whatsapp_webhook_events(source_key, received_at desc)
  where source_key is not null;

alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_webhook_events enable row level security;

drop policy if exists whatsapp_messages_select on public.whatsapp_messages;
create policy whatsapp_messages_select
  on public.whatsapp_messages
  for select
  using (
    user_id = auth.uid()
    or public.is_church_leader(church_id)
    or public.is_platform_admin()
  );

-- O cliente nunca escreve nesta integração. Escritas só ocorrem no servidor,
-- depois de autenticação do líder ou validação criptográfica do webhook Meta.
revoke insert, update, delete on public.whatsapp_messages from anon, authenticated;
grant select on public.whatsapp_messages to authenticated;
grant all on public.whatsapp_messages to service_role;

revoke all on public.whatsapp_webhook_events from anon, authenticated;
grant all on public.whatsapp_webhook_events to service_role;
