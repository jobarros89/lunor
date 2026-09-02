-- Líderes e gerentes podem consolidar a disponibilidade geral somente dos
-- integrantes dos ministérios que administram. Coordenadores mantêm o escopo
-- completo da própria igreja e cada pessoa continua vendo os próprios dados.

drop policy if exists member_availability_calendar_select
  on public.member_availability_calendar;

create policy member_availability_calendar_select
  on public.member_availability_calendar
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (
      user_id = (select auth.uid())
      or public.is_church_coord(church_id)
      or (
        ministry_id is not null
        and public.has_ministry_role(
          ministry_id,
          array['gerente', 'lider']::public.ministry_role[]
        )
      )
      or (
        ministry_id is null
        and exists (
          select 1
          from public.ministry_members target_membership
          where target_membership.church_id = member_availability_calendar.church_id
            and target_membership.user_id = member_availability_calendar.user_id
            and target_membership.active
            and public.has_ministry_role(
              target_membership.ministry_id,
              array['gerente', 'lider']::public.ministry_role[]
            )
        )
      )
    )
  );

drop policy if exists member_availability_recurring_select
  on public.member_availability_recurring;

create policy member_availability_recurring_select
  on public.member_availability_recurring
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (
      user_id = (select auth.uid())
      or public.is_church_coord(church_id)
      or (
        ministry_id is not null
        and public.has_ministry_role(
          ministry_id,
          array['gerente', 'lider']::public.ministry_role[]
        )
      )
      or (
        ministry_id is null
        and exists (
          select 1
          from public.ministry_members target_membership
          where target_membership.church_id = member_availability_recurring.church_id
            and target_membership.user_id = member_availability_recurring.user_id
            and target_membership.active
            and public.has_ministry_role(
              target_membership.ministry_id,
              array['gerente', 'lider']::public.ministry_role[]
            )
        )
      )
    )
  );
