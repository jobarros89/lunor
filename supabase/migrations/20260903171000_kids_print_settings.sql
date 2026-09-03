-- Configuração de impressão de etiquetas do LUNOR Kids.
-- A configuração é por ministério Kids; todos os membros da igreja podem ler
-- para imprimir, mas somente liderança do ministério ou admin da igreja altera.

create table if not exists public.kids_print_settings (
  ministry_id uuid primary key references public.ministries(id) on delete cascade,
  print_mode text not null default 'universal'
    check (print_mode in ('universal', 'direct')),
  label_width_mm numeric(5,1) not null default 62
    check (label_width_mm between 20 and 120),
  label_height_mm numeric(5,1) not null default 50
    check (label_height_mm between 20 and 150),
  margin_mm numeric(4,1) not null default 2.5
    check (margin_mm between 0 and 10),
  orientation text not null default 'horizontal'
    check (orientation in ('horizontal', 'vertical')),
  copies smallint not null default 1
    check (copies between 1 and 3),
  qr_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.kids_print_settings enable row level security;

drop trigger if exists kids_print_settings_updated_at on public.kids_print_settings;
create trigger kids_print_settings_updated_at
  before update on public.kids_print_settings
  for each row execute function public.set_updated_at();

create policy kids_print_settings_select on public.kids_print_settings
  for select using (
    exists (
      select 1
      from public.ministries m
      where m.id = ministry_id
        and public.is_church_member(m.church_id)
    )
  );

create policy kids_print_settings_insert on public.kids_print_settings
  for insert with check (
    public.has_ministry_role(
      ministry_id,
      array['gerente', 'lider']::public.ministry_role[]
    )
    or exists (
      select 1
      from public.ministries m
      where m.id = ministry_id
        and public.is_church_admin(m.church_id)
    )
  );

create policy kids_print_settings_update on public.kids_print_settings
  for update using (
    public.has_ministry_role(
      ministry_id,
      array['gerente', 'lider']::public.ministry_role[]
    )
    or exists (
      select 1
      from public.ministries m
      where m.id = ministry_id
        and public.is_church_admin(m.church_id)
    )
  ) with check (
    public.has_ministry_role(
      ministry_id,
      array['gerente', 'lider']::public.ministry_role[]
    )
    or exists (
      select 1
      from public.ministries m
      where m.id = ministry_id
        and public.is_church_admin(m.church_id)
    )
  );

create policy kids_print_settings_delete on public.kids_print_settings
  for delete using (
    public.has_ministry_role(
      ministry_id,
      array['gerente', 'lider']::public.ministry_role[]
    )
    or exists (
      select 1
      from public.ministries m
      where m.id = ministry_id
        and public.is_church_admin(m.church_id)
    )
  );

grant select, insert, update, delete on public.kids_print_settings to authenticated;
