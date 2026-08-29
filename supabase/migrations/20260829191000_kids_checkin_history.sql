-- LUNOR Kids — histórico operacional de entradas e saídas
-- Antes, uma reentrada no mesmo culto reutilizava a mesma linha e apagava a
-- retirada anterior. A partir daqui cada entrada é um registro novo, mantendo
-- histórico completo, mas só pode existir UMA presença ativa por criança/evento.

alter table public.child_checkins
  drop constraint if exists child_checkins_event_id_child_id_key;

create unique index if not exists child_checkins_one_active_per_child_event
  on public.child_checkins (event_id, child_id)
  where checked_out_at is null;

create index if not exists child_checkins_event_child_history_idx
  on public.child_checkins (event_id, child_id, checked_in_at desc);
