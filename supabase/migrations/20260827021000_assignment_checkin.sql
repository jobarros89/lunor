alter table public.assignments
  add column if not exists checked_in_at timestamptz;

comment on column public.assignments.checked_in_at
  is 'Momento em que a presença do voluntário foi registrada no evento.';
