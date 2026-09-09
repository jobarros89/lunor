revoke all on function public.open_kids_reception_session(uuid, uuid, text, uuid, uuid) from public;
revoke all on function public.open_kids_reception_session(uuid, uuid, text, uuid, uuid) from anon;
grant execute on function public.open_kids_reception_session(uuid, uuid, text, uuid, uuid) to authenticated;

revoke all on function public.open_kids_reception_session(uuid, uuid, text, uuid) from public;
revoke all on function public.open_kids_reception_session(uuid, uuid, text, uuid) from anon;
grant execute on function public.open_kids_reception_session(uuid, uuid, text, uuid) to authenticated;

revoke all on function public.close_kids_reception(uuid, uuid, uuid) from public;
revoke all on function public.close_kids_reception(uuid, uuid, uuid) from anon;
grant execute on function public.close_kids_reception(uuid, uuid, uuid) to authenticated;

revoke all on function public.link_guardian_account(uuid, uuid, uuid, uuid) from public;
revoke all on function public.link_guardian_account(uuid, uuid, uuid, uuid) from anon;
grant execute on function public.link_guardian_account(uuid, uuid, uuid, uuid) to authenticated;

revoke all on function public.unlink_guardian_account(uuid, uuid, uuid) from public;
revoke all on function public.unlink_guardian_account(uuid, uuid, uuid) from anon;
grant execute on function public.unlink_guardian_account(uuid, uuid, uuid) to authenticated;
