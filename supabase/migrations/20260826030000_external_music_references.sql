-- Referências externas são opcionais. A música, a letra, a cifra e seus
-- arranjos continuam pertencendo ao acervo interno do LUNOR.
alter table public.songs
  add column youtube_video_id text,
  add column spotify_track_id text,
  add constraint songs_youtube_video_id_format
    check (
      youtube_video_id is null
      or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'
    ),
  add constraint songs_spotify_track_id_format
    check (
      spotify_track_id is null
      or spotify_track_id ~ '^[A-Za-z0-9]{22}$'
    );

create unique index songs_youtube_video_unique
  on public.songs (church_id, youtube_video_id)
  where youtube_video_id is not null;

create unique index songs_spotify_track_unique
  on public.songs (church_id, spotify_track_id)
  where spotify_track_id is not null;

comment on column public.songs.youtube_video_id is
  'Referência opcional ao vídeo confirmado no YouTube; o conteúdo canônico permanece no LUNOR.';

comment on column public.songs.spotify_track_id is
  'Referência opcional à faixa confirmada no Spotify; o conteúdo canônico permanece no LUNOR.';
