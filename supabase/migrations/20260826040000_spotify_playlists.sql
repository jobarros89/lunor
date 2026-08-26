alter table public.events
  add column spotify_playlist_id text,
  add column spotify_playlist_url text,
  add column spotify_playlist_synced_at timestamptz,
  add column spotify_playlist_error text,
  add constraint events_spotify_playlist_id_format
    check (
      spotify_playlist_id is null
      or spotify_playlist_id ~ '^[A-Za-z0-9]{22}$'
    ),
  add constraint events_spotify_playlist_url_format
    check (
      spotify_playlist_url is null
      or spotify_playlist_url ~ '^https://open\.spotify\.com/playlist/[A-Za-z0-9]{22}$'
    ),
  add constraint events_spotify_playlist_error_length
    check (
      spotify_playlist_error is null
      or char_length(spotify_playlist_error) <= 1000
    );
