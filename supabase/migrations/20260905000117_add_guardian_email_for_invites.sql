alter table public.guardians
  add column if not exists email text;

update public.guardians
set email = lower(btrim(email))
where email is not null
  and email <> lower(btrim(email));

create unique index if not exists guardians_church_ministry_email_uidx
  on public.guardians (church_id, ministry_id, lower(email))
  where email is not null
    and btrim(email) <> '';
