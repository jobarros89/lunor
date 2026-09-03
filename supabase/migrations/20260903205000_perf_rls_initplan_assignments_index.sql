-- PERF-01 — otimizações conservadoras de RLS/índice em caminhos autenticados.
--
-- Segurança: estas alterações NÃO ampliam autorização. As expressões abaixo
-- preservam as mesmas regras e apenas envolvem auth.uid() em SELECT para que
-- o Postgres possa calculá-lo uma vez por statement (initplan), em vez de
-- reavaliá-lo para cada linha examinada.

alter policy profiles_select
  on public.profiles
  using (
    id = (select auth.uid())
    or public.shares_church_with(id)
  );

alter policy profiles_update
  on public.profiles
  using (id = (select auth.uid()));

alter policy assignments_select
  on public.assignments
  using (
    user_id = (select auth.uid())
    or public.is_church_coord(church_id)
    or public.is_ministry_member(ministry_id)
  );

alter policy assignments_self_update
  on public.assignments
  using (
    user_id = (select auth.uid())
    and public.is_church_member(church_id)
  );

alter policy member_availability_select
  on public.member_availability
  using (
    user_id = (select auth.uid())
    or public.is_church_coord(church_id)
    or public.has_ministry_role(
      ministry_id,
      array['gerente', 'lider']::public.ministry_role[]
    )
  );

alter policy member_availability_self_insert
  on public.member_availability
  with check (
    user_id = (select auth.uid())
    and (
      public.is_ministry_member(ministry_id)
      or public.is_church_coord(church_id)
    )
  );

alter policy member_availability_self_update
  on public.member_availability
  using (
    user_id = (select auth.uid())
    and (
      public.is_ministry_member(ministry_id)
      or public.is_church_coord(church_id)
    )
  )
  with check (
    user_id = (select auth.uid())
    and (
      public.is_ministry_member(ministry_id)
      or public.is_church_coord(church_id)
    )
  );

alter policy member_availability_self_delete
  on public.member_availability
  using (
    user_id = (select auth.uid())
    and (
      public.is_ministry_member(ministry_id)
      or public.is_church_coord(church_id)
    )
  );

alter policy member_availability_calendar_self_insert
  on public.member_availability_calendar
  with check (
    user_id = (select auth.uid())
    and (
      public.is_church_coord(church_id)
      or (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

alter policy member_availability_calendar_self_update
  on public.member_availability_calendar
  using (
    user_id = (select auth.uid())
    and (
      public.is_church_coord(church_id)
      or (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  )
  with check (
    user_id = (select auth.uid())
    and (
      public.is_church_coord(church_id)
      or (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

alter policy member_availability_calendar_self_delete
  on public.member_availability_calendar
  using (
    user_id = (select auth.uid())
    and (
      public.is_church_coord(church_id)
      or (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

alter policy member_availability_recurring_self_insert
  on public.member_availability_recurring
  with check (
    user_id = (select auth.uid())
    and (
      public.is_church_coord(church_id)
      or (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

alter policy member_availability_recurring_self_update
  on public.member_availability_recurring
  using (
    user_id = (select auth.uid())
    and (
      public.is_church_coord(church_id)
      or (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  )
  with check (
    user_id = (select auth.uid())
    and (
      public.is_church_coord(church_id)
      or (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

alter policy member_availability_recurring_self_delete
  on public.member_availability_recurring
  using (
    user_id = (select auth.uid())
    and (
      public.is_church_coord(church_id)
      or (ministry_id is null and public.is_church_member(church_id))
      or (ministry_id is not null and public.is_ministry_member(ministry_id))
    )
  );

-- assignments é uma das tabelas mais acessadas e praticamente toda leitura
-- autenticada é escopada por igreja. O FK church_id não tinha índice líder.
-- Índice aditivo: não altera semântica nem autorização.
create index if not exists idx_assignments_church
  on public.assignments (church_id);
