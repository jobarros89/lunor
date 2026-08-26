alter table public.songs
  add column time_signature text
  check (
    time_signature is null
    or time_signature ~ '^([1-9]|[12][0-9]|3[0-2])/(1|2|4|8|16|32)$'
  );

comment on column public.songs.time_signature is
  'Compasso musical confirmado, como 4/4, 6/8 ou 12/8.';
