-- A cifra é armazenada no tom original definido em songs.default_key.
-- Versões transpostas são calculadas em tempo de execução e não persistidas.
alter table public.songs
  add column chord_chart text;
