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
