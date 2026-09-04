-- Rate limiting para o assistente de IA: 20 mensagens/hora por usuário + igreja.
-- Tabela de auditoria de uso com limpeza automática de registros > 24h.

create table public.ai_usage_logs (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  church_id  uuid not null references public.churches (id) on delete cascade,
  created_at timestamp with time zone not null default now()
);

create index idx_ai_usage_user_church_time
  on public.ai_usage_logs (user_id, church_id, created_at desc);

-- Limpeza automática: remover logs com > 24h (mantém apenas a janela de interesse
-- para rate limiting e um pouco de histórico pra auditoria eventual).
create or replace function public.cleanup_old_ai_usage_logs()
returns void
language sql
security definer
set search_path = public
as $$
delete from public.ai_usage_logs
where created_at < now() - interval '24 hours';
$$;

-- Executar limpeza a cada 6 horas via Cloudflare Cron (mesmo padrão de lembretes_do_dia).
-- Não cria cron_schedule aqui — será acionado pela rota /api/cron existente.

-- Sem RLS: esse table é append-only e usa índices de leitura rápida para rate limiting.
-- Acesso é apenas via servidor (POST /api/ai/assistant lê + insere), nunca via cliente.
alter table public.ai_usage_logs enable row level security;

create policy "no_direct_access" on public.ai_usage_logs
  for all
  to public
  using (false);

-- Service role (usado pelo servidor Next.js) bypass RLS automatically.
-- Profiles e churches já têm suas próprias policies; o join aqui é transparente.
