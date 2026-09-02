create table public.member_availability_month_submissions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  month_start date not null check (extract(day from month_start) = 1),
  period text not null check (period in ('all_day', 'morning', 'afternoon', 'evening')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (church_id, ministry_id, user_id, campus_id, month_start, period)
);

create index member_availability_month_submissions_lookup_idx
  on public.member_availability_month_submissions
  (church_id, ministry_id, month_start, campus_id, period);

alter table public.member_availability_month_submissions enable row level security;

create policy month_availability_select
on public.member_availability_month_submissions
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_church_coord(church_id)
  or public.has_ministry_role(
    ministry_id,
    array['gerente'::public.ministry_role, 'lider'::public.ministry_role]
  )
);

create policy month_availability_insert
on public.member_availability_month_submissions
for insert to authenticated
with check (
  user_id = auth.uid()
  and (
    public.is_church_coord(church_id)
    or public.has_ministry_role(
      ministry_id,
      array[
        'gerente'::public.ministry_role,
        'lider'::public.ministry_role,
        'voluntario'::public.ministry_role
      ]
    )
  )
  and exists (
    select 1 from public.ministries m
    where m.id = ministry_id and m.church_id = church_id
  )
);

create policy month_availability_update
on public.member_availability_month_submissions
for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    public.is_church_coord(church_id)
    or public.has_ministry_role(
      ministry_id,
      array[
        'gerente'::public.ministry_role,
        'lider'::public.ministry_role,
        'voluntario'::public.ministry_role
      ]
    )
  )
);

grant select, insert, update on public.member_availability_month_submissions to authenticated;

create trigger audit_member_availability_month_submissions
after insert or update or delete on public.member_availability_month_submissions
for each row execute function public.log_audit();

insert into public.member_availability_month_submissions (
  church_id, ministry_id, campus_id, user_id, month_start, period, submitted_at
)
select
  church_id,
  ministry_id,
  campus_id,
  user_id,
  date_trunc('month', availability_date)::date,
  period,
  max(updated_at)
from public.member_availability_calendar
where ministry_id is not null
group by church_id, ministry_id, campus_id, user_id, date_trunc('month', availability_date)::date, period
on conflict do nothing;
