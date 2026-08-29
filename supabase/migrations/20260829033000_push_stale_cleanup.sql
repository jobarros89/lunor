-- Limpeza automática de inscrições Web Push expiradas (404/410).
-- Mantém a parede entre igrejas: o chamador só obtém/limpa inscrições de
-- usuários com quem compartilha igreja ativa.

drop function if exists public.get_push_subscriptions(uuid[]);

create function public.get_push_subscriptions(p_user_ids uuid[])
returns table (id uuid, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select s.id, s.endpoint, s.p256dh, s.auth
  from push_subscriptions s
  where s.user_id = any (p_user_ids)
    and public.shares_church_with(s.user_id);
$$;

revoke all on function public.get_push_subscriptions(uuid[]) from public;
grant execute on function public.get_push_subscriptions(uuid[]) to authenticated;

create or replace function public.delete_stale_push_subscriptions(p_subscription_ids uuid[])
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_deleted integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  delete from push_subscriptions s
  where s.id = any (p_subscription_ids)
    and public.shares_church_with(s.user_id);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.delete_stale_push_subscriptions(uuid[]) from public;
grant execute on function public.delete_stale_push_subscriptions(uuid[]) to authenticated;
