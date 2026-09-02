-- Índices para a leitura consolidada da equipe e para cobrir as FKs de user_id.

create index if not exists idx_member_availability_calendar_user
  on public.member_availability_calendar (user_id, church_id, availability_date);

create index if not exists idx_member_availability_recurring_user
  on public.member_availability_recurring (user_id, church_id, weekday);
