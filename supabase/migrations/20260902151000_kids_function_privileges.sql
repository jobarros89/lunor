-- Complemento para instalações que já receberam a primeira versão da migração.
-- Funções SECURITY DEFINER não ficam executáveis anonimamente.

revoke all on function public.is_event_operational(uuid) from anon;
revoke all on function public.is_guardian_at_church(uuid) from anon;
revoke all on function public.is_guardian_of(uuid) from anon;
revoke all on function public.can_operate_kids(uuid, uuid, uuid) from anon;
revoke all on function public.create_guardian_invite(uuid) from anon;
revoke all on function public.redeem_guardian_invite(text) from anon;
revoke all on function public.guardian_checkin_child(uuid, uuid, uuid, uuid, uuid) from anon;
revoke all on function public.guardian_checkout_child(uuid) from anon;
revoke all on function public.guardian_current_kids_event(uuid, uuid) from anon;
revoke all on function public.create_child_with_primary_guardian(
  uuid, uuid, text, date, text, text, text, text, text, boolean, text, text, text, uuid
) from anon;
revoke all on function public.child_page_delivery_status(uuid) from anon;
revoke all on function public.complete_member_onboarding(uuid, uuid[], text, jsonb) from anon;
revoke all on function public.dedupe_active_child_call_before_insert()
  from public, anon, authenticated;
revoke all on function public.log_child_guardian_audit()
  from public, anon, authenticated;
