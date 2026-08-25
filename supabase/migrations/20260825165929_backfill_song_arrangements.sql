-- Backfill único e reexecutável das cifras legadas para arranjos versionados.
--
-- Não é possível reconstruir as cifras que eram usadas em cultos anteriores ao
-- versionamento. A versão 1 abaixo representa exatamente o conteúdo existente
-- em songs.chord_chart no momento deste backfill; o campo legado é preservado.

-- Evita corrida com edições do acervo enquanto as validações e os vínculos são
-- produzidos. O runner de migrations mantém estas locks até o fim da transação.
begin;
lock table public.songs in share row exclusive mode;
lock table public.song_arrangements in share row exclusive mode;
lock table public.song_arrangement_versions in share row exclusive mode;
lock table public.setlist_items in share row exclusive mode;

-- A coluna legada não tinha constraints no banco. Falhar com uma mensagem
-- explícita é mais seguro do que truncar conteúdo ou apagar um tom inválido.
do $$
begin
  if exists (
    select 1
    from public.songs s
    where s.chord_chart is not null
      and btrim(s.chord_chart) <> ''
      and char_length(s.chord_chart) > 20000
  ) then
    raise exception
      'backfill_song_arrangements: chord_chart excede 20000 caracteres';
  end if;

  if exists (
    select 1
    from public.songs s
    where s.chord_chart is not null
      and btrim(s.chord_chart) <> ''
      and s.default_key is not null
      and s.default_key !~ '^[A-G](#|b)?m?$'
  ) then
    raise exception
      'backfill_song_arrangements: default_key incompatível com original_key';
  end if;

  -- Uma versão 1 anterior só pode ser reutilizada quando representa os mesmos
  -- dados legados. Qualquer divergência interrompe a migration para revisão,
  -- em vez de sobrescrever histórico ou vinculá-lo ao conteúdo errado.
  if exists (
    select 1
    from public.songs s
    join public.song_arrangements a
      on a.church_id = s.church_id
     and a.song_id = s.id
     and lower(a.name) = lower('Arranjo principal')
    join public.song_arrangement_versions v
      on v.church_id = a.church_id
     and v.arrangement_id = a.id
     and v.version_number = 1
    where s.chord_chart is not null
      and btrim(s.chord_chart) <> ''
      and (
        v.format <> 'PLAIN'
        or v.content is distinct from s.chord_chart
        or v.original_key is distinct from s.default_key
        or v.bpm is distinct from s.bpm
      )
  ) then
    raise exception
      'backfill_song_arrangements: versão 1 existente diverge da cifra legada';
  end if;
end
$$;

-- Identidade estável por música. A unique case-insensitive criada na migration
-- 31 continua sendo a proteção final contra duplicação concorrente.
insert into public.song_arrangements (church_id, song_id, name)
select s.church_id, s.id, 'Arranjo principal'
from public.songs s
where s.chord_chart is not null
  and btrim(s.chord_chart) <> ''
  and not exists (
    select 1
    from public.song_arrangements a
    where a.church_id = s.church_id
      and a.song_id = s.id
      and lower(a.name) = lower('Arranjo principal')
  );

-- A cifra permanece byte a byte como estava em songs.chord_chart. Não há trim,
-- normalização nem criação de song_imports artificiais.
insert into public.song_arrangement_versions (
  church_id,
  arrangement_id,
  version_number,
  format,
  content,
  original_key,
  bpm,
  metadata
)
select
  s.church_id,
  a.id,
  1,
  'PLAIN',
  s.chord_chart,
  s.default_key,
  s.bpm,
  jsonb_build_object(
    'source', 'songs.chord_chart',
    'migration', 'backfill_song_arrangements'
  )
from public.songs s
join public.song_arrangements a
  on a.church_id = s.church_id
 and a.song_id = s.id
 and lower(a.name) = lower('Arranjo principal')
where s.chord_chart is not null
  and btrim(s.chord_chart) <> ''
  and not exists (
    select 1
    from public.song_arrangement_versions v
    where v.church_id = a.church_id
      and v.arrangement_id = a.id
      and v.version_number = 1
  );

-- Defaults já escolhidos pela igreja têm precedência e nunca são substituídos.
update public.songs s
set default_arrangement_id = a.id
from public.song_arrangements a
where s.default_arrangement_id is null
  and s.chord_chart is not null
  and btrim(s.chord_chart) <> ''
  and a.church_id = s.church_id
  and a.song_id = s.id
  and lower(a.name) = lower('Arranjo principal');

-- Setlists antigos passam a apontar para o snapshot criado agora. Tom do culto,
-- notas, posição e demais campos não entram no SET e permanecem intactos.
update public.setlist_items si
set arrangement_id = a.id,
    arrangement_version_id = v.id
from public.songs s
join public.song_arrangements a
  on a.church_id = s.church_id
 and a.song_id = s.id
 and lower(a.name) = lower('Arranjo principal')
join public.song_arrangement_versions v
  on v.church_id = a.church_id
 and v.arrangement_id = a.id
 and v.version_number = 1
where si.church_id = s.church_id
  and si.song_id = s.id
  and si.arrangement_id is null
  and si.arrangement_version_id is null
  and s.chord_chart is not null
  and btrim(s.chord_chart) <> '';

commit;
