-- Credenciais OAuth são armazenadas cifradas pela aplicação. Não há grants
-- para anon e somente líderes/coordenadores enxergam os registros cifrados.
create table public.church_music_integrations (
  church_id                uuid not null references public.churches (id) on delete cascade,
  provider                 text not null check (provider in ('YOUTUBE', 'SPOTIFY')),
  account_external_id      text,
  account_label            text,
  access_token_ciphertext  text not null,
  refresh_token_ciphertext text,
  token_expires_at         timestamptz,
  scopes                    text[] not null default '{}',
  created_by                uuid references public.profiles (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  primary key (church_id, provider),
  check (char_length(access_token_ciphertext) between 20 and 8000),
  check (
    refresh_token_ciphertext is null
    or char_length(refresh_token_ciphertext) between 20 and 8000
  ),
  check (account_external_id is null or char_length(account_external_id) <= 255),
  check (account_label is null or char_length(account_label) <= 255)
);

create trigger church_music_integrations_updated_at
  before update on public.church_music_integrations
  for each row execute function public.set_updated_at();

create table public.music_oauth_states (
  state_hash  text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  church_id   uuid not null references public.churches (id) on delete cascade,
  provider    text not null check (provider in ('YOUTUBE', 'SPOTIFY')),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  return_to   text not null check (return_to ~ '^/[^/].*' or return_to ~ '^/[A-Za-z0-9_-]+$'),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index idx_music_oauth_states_expiry on public.music_oauth_states (expires_at);

alter table public.events
  add column youtube_playlist_id text,
  add column youtube_playlist_url text,
  add column youtube_playlist_synced_at timestamptz,
  add column youtube_playlist_error text,
  add constraint events_youtube_playlist_id_format
    check (
      youtube_playlist_id is null
      or youtube_playlist_id ~ '^[A-Za-z0-9_-]{10,80}$'
    ),
  add constraint events_youtube_playlist_url_format
    check (
      youtube_playlist_url is null
      or youtube_playlist_url ~ '^https://www\.youtube\.com/playlist\?list=[A-Za-z0-9_-]{10,80}$'
    ),
  add constraint events_youtube_playlist_error_length
    check (
      youtube_playlist_error is null
      or char_length(youtube_playlist_error) <= 1000
    );

alter table public.church_music_integrations enable row level security;
alter table public.music_oauth_states enable row level security;

create policy church_music_integrations_select
  on public.church_music_integrations for select to authenticated
  using (
    public.is_louvor_leader(church_id)
    or public.is_church_coord(church_id)
  );

create policy church_music_integrations_insert
  on public.church_music_integrations for insert to authenticated
  with check (
    public.is_louvor_leader(church_id)
    or public.is_church_coord(church_id)
  );

create policy church_music_integrations_update
  on public.church_music_integrations for update to authenticated
  using (
    public.is_louvor_leader(church_id)
    or public.is_church_coord(church_id)
  )
  with check (
    public.is_louvor_leader(church_id)
    or public.is_church_coord(church_id)
  );

create policy church_music_integrations_delete
  on public.church_music_integrations for delete to authenticated
  using (
    public.is_louvor_leader(church_id)
    or public.is_church_coord(church_id)
  );

create policy music_oauth_states_select
  on public.music_oauth_states for select to authenticated
  using (
    user_id = auth.uid()
    and (
      public.is_louvor_leader(church_id)
      or public.is_church_coord(church_id)
    )
  );

create policy music_oauth_states_insert
  on public.music_oauth_states for insert to authenticated
  with check (
    user_id = auth.uid()
    and expires_at <= now() + interval '15 minutes'
    and expires_at > now()
    and (
      public.is_louvor_leader(church_id)
      or public.is_church_coord(church_id)
    )
  );

create policy music_oauth_states_delete
  on public.music_oauth_states for delete to authenticated
  using (user_id = auth.uid());

revoke all on table public.church_music_integrations from anon, authenticated;
revoke all on table public.music_oauth_states from anon, authenticated;

grant select, insert, update, delete
  on table public.church_music_integrations to authenticated;
grant select, insert, delete
  on table public.music_oauth_states to authenticated;

grant select, insert, update, delete
  on table public.church_music_integrations,
           public.music_oauth_states
  to service_role;
