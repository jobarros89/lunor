-- Coordenadores podem registrar a própria disponibilidade em qualquer ministério
-- da igreja, mesmo sem membership explícita naquele ministério.

drop policy if exists member_availability_self_insert on public.member_availability;
drop policy if exists member_availability_self_update on public.member_availability;
drop policy if exists member_availability_self_delete on public.member_availability;

create policy member_availability_self_insert on public.member_availability
  for insert with check (
    user_id = auth.uid()
    and (
      public.is_ministry_member(ministry_id)
      or public.is_church_coord(church_id)
    )
  );

create policy member_availability_self_update on public.member_availability
  for update using (
    user_id = auth.uid()
    and (
      public.is_ministry_member(ministry_id)
      or public.is_church_coord(church_id)
    )
  ) with check (
    user_id = auth.uid()
    and (
      public.is_ministry_member(ministry_id)
      or public.is_church_coord(church_id)
    )
  );

create policy member_availability_self_delete on public.member_availability
  for delete using (
    user_id = auth.uid()
    and (
      public.is_ministry_member(ministry_id)
      or public.is_church_coord(church_id)
    )
  );

drop policy if exists member_availability_calendar_self_insert on public.member_availability_calendar;
drop policy if exists member_availability_calendar_self_update on public.member_availability_calendar;
drop policy if exists member_availability_calendar_self_delete on public.member_availability_calendar;

create policy member_availability_calendar_self_insert
  on public.member_availability_calendar
  for insert with check (
    user_id = auth.uid()
    and (
      public.is_church_coord(church_id)
      or (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

create policy member_availability_calendar_self_update
  on public.member_availability_calendar
  for update using (
    user_id = auth.uid()
    and (
      public.is_church_coord(church_id)
      or (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  ) with check (
    user_id = auth.uid()
    and (
      public.is_church_coord(church_id)
      or (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

create policy member_availability_calendar_self_delete
  on public.member_availability_calendar
  for delete using (
    user_id = auth.uid()
    and (
      public.is_church_coord(church_id)
      or (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

drop policy if exists member_availability_recurring_self_insert on public.member_availability_recurring;
drop policy if exists member_availability_recurring_self_update on public.member_availability_recurring;
drop policy if exists member_availability_recurring_self_delete on public.member_availability_recurring;

create policy member_availability_recurring_self_insert
  on public.member_availability_recurring
  for insert with check (
    user_id = auth.uid()
    and (
      public.is_church_coord(church_id)
      or (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

create policy member_availability_recurring_self_update
  on public.member_availability_recurring
  for update using (
    user_id = auth.uid()
    and (
      public.is_church_coord(church_id)
      or (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  ) with check (
    user_id = auth.uid()
    and (
      public.is_church_coord(church_id)
      or (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

create policy member_availability_recurring_self_delete
  on public.member_availability_recurring
  for delete using (
    user_id = auth.uid()
    and (
      public.is_church_coord(church_id)
      or (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );
