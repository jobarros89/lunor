alter table public.profiles
  add column if not exists departments text[] not null default '{}'::text[];

comment on column public.profiles.departments is 'Departamentos selecionados pelo integrante no onboarding.';
