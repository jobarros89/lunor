-- LUNOR availability hardening: prevent direct API execution of trigger guards
-- and restrict the leader-facing RPC to signed-in users only.

revoke execute on function public.create_availability_request(uuid, uuid, text, uuid[], timestamptz) from public, anon;
grant execute on function public.create_availability_request(uuid, uuid, text, uuid[], timestamptz) to authenticated;

revoke execute on function public.guard_availability_request_event() from public, anon, authenticated;
revoke execute on function public.guard_member_availability() from public, anon, authenticated;
