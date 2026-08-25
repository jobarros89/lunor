-- Arranjos versionados: identidade estável por igreja, versões imutáveis e
-- origem auditável das importações. O repertório existente continua válido
-- enquanto arrangement_id e arrangement_version_id permanecerem nulos.

-- FKs compostas usam church_id para que nenhuma referência possa atravessar
-- tenants, mesmo quando a aplicação deixar de enviar um filtro por engano.
alter table public.songs
  add constraint songs_church_id_id_key unique (church_id, id);

create table public.song_arrangements (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  song_id     uuid not null,
  name        text not null
              check (
                name = btrim(name)
                and char_length(name) between 1 and 120
              ),
  active      boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint song_arrangements_song_fkey
    foreign key (church_id, song_id)
    references public.songs (church_id, id)
    on delete cascade,
  constraint song_arrangements_church_id_id_key
    unique (church_id, id),
  constraint song_arrangements_song_identity_key
    unique (church_id, song_id, id)
);

create unique index song_arrangements_name_unique
  on public.song_arrangements (church_id, song_id, lower(name));
create index idx_song_arrangements_church_song_active
  on public.song_arrangements (church_id, song_id, active);
create index idx_song_arrangements_created_by
  on public.song_arrangements (created_by)
  where created_by is not null;

create trigger song_arrangements_updated_at
  before update on public.song_arrangements
  for each row execute function public.set_updated_at();

create table public.song_arrangement_versions (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references public.churches (id) on delete cascade,
  arrangement_id  uuid not null,
  version_number  integer not null check (version_number > 0),
  format          text not null check (format in ('PLAIN', 'CHORDPRO')),
  content         text not null
                  check (char_length(btrim(content)) between 1 and 20000),
  original_key    text
                  check (
                    original_key is null
                    or (
                      char_length(original_key) <= 8
                      and original_key ~ '^[A-G](#|b)?m?$'
                    )
                  ),
  bpm             integer check (bpm between 20 and 300),
  time_signature  text
                  check (
                    time_signature is null
                    or time_signature ~ '^([1-9]|[12][0-9]|3[0-2])/(1|2|4|8|16|32)$'
                  ),
  metadata        jsonb not null default '{}'::jsonb
                  check (jsonb_typeof(metadata) = 'object'),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint song_arrangement_versions_arrangement_fkey
    foreign key (church_id, arrangement_id)
    references public.song_arrangements (church_id, id)
    on delete cascade,
  constraint song_arrangement_versions_number_key
    unique (arrangement_id, version_number),
  constraint song_arrangement_versions_identity_key
    unique (church_id, arrangement_id, id)
);

create index idx_song_arrangement_versions_arrangement_number
  on public.song_arrangement_versions (arrangement_id, version_number desc);
create index idx_song_arrangement_versions_church
  on public.song_arrangement_versions (church_id);
create index idx_song_arrangement_versions_created_by
  on public.song_arrangement_versions (created_by)
  where created_by is not null;

create table public.song_imports (
  id                    uuid primary key default gen_random_uuid(),
  church_id             uuid not null references public.churches (id) on delete cascade,
  song_id               uuid,
  arrangement_id        uuid,
  resulting_version_id  uuid,
  source_kind           text not null check (source_kind in ('PASTE', 'FILE')),
  source_format         text not null check (source_format in ('PLAIN', 'CHORDPRO')),
  original_filename     text check (char_length(original_filename) <= 255),
  mime_type             text check (char_length(mime_type) <= 120),
  raw_content           text check (char_length(raw_content) <= 20000),
  storage_object_path   text
                        check (
                          storage_object_path is null
                          or char_length(btrim(storage_object_path)) between 1 and 1024
                        ),
  raw_sha256            text check (raw_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  parser_version        text not null
                        check (char_length(btrim(parser_version)) between 1 and 40),
  detected_metadata     jsonb not null default '{}'::jsonb
                        check (jsonb_typeof(detected_metadata) = 'object'),
  warnings              jsonb not null default '[]'::jsonb
                        check (jsonb_typeof(warnings) = 'array'),
  status                text not null
                        check (status in ('RECEIVED', 'PARSED', 'CONFIRMED', 'FAILED')),
  error_message         text check (char_length(error_message) <= 2000),
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint song_imports_source_key
    check (raw_content is not null or storage_object_path is not null),
  constraint song_imports_arrangement_requires_song
    check (arrangement_id is null or song_id is not null),
  constraint song_imports_version_requires_arrangement
    check (resulting_version_id is null or arrangement_id is not null),
  constraint song_imports_status_references
    check (
      (
        status = 'CONFIRMED'
        and song_id is not null
        and arrangement_id is not null
        and resulting_version_id is not null
      )
      or (status <> 'CONFIRMED' and resulting_version_id is null)
    ),
  constraint song_imports_failure_message
    check (
      (status = 'FAILED' and char_length(btrim(error_message)) between 1 and 2000)
      or (status <> 'FAILED' and error_message is null)
    ),
  constraint song_imports_song_fkey
    foreign key (church_id, song_id)
    references public.songs (church_id, id)
    on delete cascade,
  constraint song_imports_arrangement_fkey
    foreign key (church_id, song_id, arrangement_id)
    references public.song_arrangements (church_id, song_id, id)
    on delete cascade,
  constraint song_imports_version_fkey
    foreign key (church_id, arrangement_id, resulting_version_id)
    references public.song_arrangement_versions (church_id, arrangement_id, id)
    on delete cascade
);

create index idx_song_imports_church_status_created
  on public.song_imports (church_id, status, created_at desc);
create index idx_song_imports_song
  on public.song_imports (song_id)
  where song_id is not null;
create index idx_song_imports_arrangement
  on public.song_imports (arrangement_id)
  where arrangement_id is not null;
create index idx_song_imports_resulting_version
  on public.song_imports (resulting_version_id)
  where resulting_version_id is not null;
create index idx_song_imports_raw_sha256
  on public.song_imports (church_id, raw_sha256)
  where raw_sha256 is not null;
create index idx_song_imports_created_by
  on public.song_imports (created_by)
  where created_by is not null;

create trigger song_imports_updated_at
  before update on public.song_imports
  for each row execute function public.set_updated_at();

-- O arranjo padrão precisa pertencer simultaneamente à igreja e à própria
-- música. A FK é adicionada depois da tabela de arranjos para evitar ciclo de
-- criação.
alter table public.songs
  add column default_arrangement_id uuid,
  add constraint songs_default_arrangement_fkey
    foreign key (church_id, id, default_arrangement_id)
    references public.song_arrangements (church_id, song_id, id)
    on delete restrict;

create index idx_songs_default_arrangement
  on public.songs (default_arrangement_id)
  where default_arrangement_id is not null;

-- Rollout incremental: itens antigos mantêm ambos nulos. Itens novos que
-- escolherem um arranjo já precisam fixar uma versão explícita.
alter table public.setlist_items
  add column arrangement_id uuid,
  add column arrangement_version_id uuid,
  add constraint setlist_items_arrangement_pair
    check (
      (arrangement_id is null and arrangement_version_id is null)
      or (arrangement_id is not null and arrangement_version_id is not null)
    ),
  add constraint setlist_items_arrangement_fkey
    foreign key (church_id, song_id, arrangement_id)
    references public.song_arrangements (church_id, song_id, id)
    on delete restrict,
  add constraint setlist_items_arrangement_version_fkey
    foreign key (church_id, arrangement_id, arrangement_version_id)
    references public.song_arrangement_versions (church_id, arrangement_id, id)
    on delete restrict;

create index idx_setlist_items_arrangement
  on public.setlist_items (church_id, song_id, arrangement_id)
  where arrangement_id is not null;
create index idx_setlist_items_arrangement_version
  on public.setlist_items (church_id, arrangement_id, arrangement_version_id)
  where arrangement_version_id is not null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.song_arrangements enable row level security;
alter table public.song_arrangement_versions enable row level security;
alter table public.song_imports enable row level security;

create policy song_arrangements_select on public.song_arrangements
  for select
  to authenticated
  using (public.is_church_member(church_id));

create policy song_arrangements_insert on public.song_arrangements
  for insert
  to authenticated
  with check (
    public.is_louvor_leader(church_id)
    or public.is_church_coord(church_id)
  );

create policy song_arrangements_update on public.song_arrangements
  for update
  to authenticated
  using (
    public.is_louvor_leader(church_id)
    or public.is_church_coord(church_id)
  )
  with check (
    public.is_louvor_leader(church_id)
    or public.is_church_coord(church_id)
  );

create policy song_arrangement_versions_select
  on public.song_arrangement_versions
  for select
  to authenticated
  using (public.is_church_member(church_id));

create policy song_arrangement_versions_insert
  on public.song_arrangement_versions
  for insert
  to authenticated
  with check (
    public.is_louvor_leader(church_id)
    or public.is_church_coord(church_id)
  );

create policy song_imports_select on public.song_imports
  for select
  to authenticated
  using (
    public.is_louvor_leader(church_id)
    or public.is_church_coord(church_id)
  );

create policy song_imports_insert on public.song_imports
  for insert
  to authenticated
  with check (
    public.is_louvor_leader(church_id)
    or public.is_church_coord(church_id)
  );

create policy song_imports_update on public.song_imports
  for update
  to authenticated
  using (
    public.is_louvor_leader(church_id)
    or public.is_church_coord(church_id)
  )
  with check (
    public.is_louvor_leader(church_id)
    or public.is_church_coord(church_id)
  );

-- Grants explícitos: RLS decide as linhas; grants limitam quais operações
-- chegam às policies. Anon não acessa nenhuma das três tabelas.
revoke all on table public.song_arrangements from anon, authenticated;
revoke all on table public.song_arrangement_versions from anon, authenticated;
revoke all on table public.song_imports from anon, authenticated;

grant select, insert on table public.song_arrangements to authenticated;
grant update (name, active) on table public.song_arrangements to authenticated;
grant select, insert on table public.song_arrangement_versions to authenticated;
grant select, insert on table public.song_imports to authenticated;
grant update (
  song_id,
  arrangement_id,
  resulting_version_id,
  parser_version,
  detected_metadata,
  warnings,
  status,
  error_message
) on table public.song_imports to authenticated;

grant select, insert, update, delete
  on table public.song_arrangements,
           public.song_arrangement_versions,
           public.song_imports
  to service_role;

-- Defesa explícita contra regressão dos default privileges do projeto.
revoke update, delete on table public.song_arrangement_versions from authenticated;
