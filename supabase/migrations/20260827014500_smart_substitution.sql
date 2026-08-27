alter type public.assignment_status add value if not exists 'substituido' after 'substituicao_solicitada';

alter table public.substitution_requests
  add column if not exists replacement_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists resolved_at timestamptz;

comment on column public.substitution_requests.replacement_user_id
  is 'Pessoa escolhida para assumir a escala quando o pedido for atendido.';
comment on column public.substitution_requests.resolved_at
  is 'Momento em que o pedido de substituição foi resolvido.';
