-- Reconcile an already-present LUNOR availability + Kids QR schema.
-- The feature objects were found complete in this database, but the migration
-- was not present in Supabase migration history. Keep this operation idempotent.

alter table public.child_checkins
  add column if not exists pickup_qr_token text not null
  default replace(gen_random_uuid()::text, '-', '');

create unique index if not exists idx_child_checkins_pickup_qr_token
  on public.child_checkins (pickup_qr_token);

alter table public.availability_requests enable row level security;
alter table public.availability_request_events enable row level security;
alter table public.member_availability enable row level security;

create index if not exists idx_availability_requests_ministry
  on public.availability_requests (ministry_id, created_at desc);
create index if not exists idx_availability_request_events_event
  on public.availability_request_events (event_id, ministry_id);
create index if not exists idx_member_availability_ministry_event
  on public.member_availability (ministry_id, event_id, status);
create index if not exists idx_member_availability_user
  on public.member_availability (user_id, event_id);

grant execute on function public.create_availability_request(uuid, uuid, text, uuid[], timestamptz)
  to authenticated;
