\set ON_ERROR_STOP on

begin;

-- Fixtures legadas criadas depois do reset. A migration é reexecutada dentro
-- desta transação para validar o backfill sem deixar dados de teste no banco.
insert into public.churches (id, name, slug)
values
  ('00000000-0000-4000-8000-0000000000a1', 'Igreja Backfill A', 'backfill-a'),
  ('00000000-0000-4000-8000-0000000000b1', 'Igreja Backfill B', 'backfill-b');

insert into public.events (id, church_id, title, starts_at)
values
  (
    '00000000-0000-4000-8000-0000000000e1',
    '00000000-0000-4000-8000-0000000000a1',
    'Culto legado A',
    '2026-08-30 10:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-0000000000e2',
    '00000000-0000-4000-8000-0000000000b1',
    'Culto legado B',
    '2026-08-30 12:00:00+00'
  );

insert into public.songs (
  id,
  church_id,
  title,
  default_key,
  bpm,
  lyrics,
  chord_chart,
  active
)
values
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-0000000000a1',
    'Cifra preservada',
    'C',
    72,
    'Letra original',
    E'  [Verso]\nC   G\nLetra  \n',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-0000000000a1',
    'Sem cifra nula',
    'D',
    80,
    'Sem cifra',
    null,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-0000000000a1',
    'Sem cifra espaços',
    'E',
    90,
    'Sem cifra útil',
    '   ',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000107',
    '00000000-0000-4000-8000-0000000000a1',
    'Sem cifra vazia',
    'F',
    92,
    'String vazia',
    '',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000104',
    '00000000-0000-4000-8000-0000000000a1',
    'Música arquivada',
    'F',
    68,
    'Histórico preservado',
    E'F C Dm Bb\n',
    false
  ),
  (
    '00000000-0000-4000-8000-000000000105',
    '00000000-0000-4000-8000-0000000000a1',
    'Default anterior',
    'G',
    76,
    'Default não troca',
    E'G D Em C\n',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000106',
    '00000000-0000-4000-8000-0000000000a1',
    'Setlist versionado',
    'A',
    84,
    'Seleção não troca',
    E'A E F#m D\n',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-0000000000b1',
    'Cifra da igreja B',
    'Bb',
    64,
    'Tenant B',
    E'Bb F Gm Eb\n',
    true
  );

-- Default anterior da música 105: precisa sobreviver ao backfill.
insert into public.song_arrangements (id, church_id, song_id, name)
values (
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-000000000105',
  'Acústico oficial'
);

insert into public.song_arrangement_versions (
  id,
  church_id,
  arrangement_id,
  version_number,
  format,
  content,
  original_key,
  bpm
)
values (
  '00000000-0000-4000-8000-000000000601',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-000000000501',
  1,
  'PLAIN',
  E'G C G D\n',
  'G',
  76
);

update public.songs
set default_arrangement_id = '00000000-0000-4000-8000-000000000501'
where id = '00000000-0000-4000-8000-000000000105';

-- Seleção explícita anterior da música 106: também não pode ser substituída.
insert into public.song_arrangements (id, church_id, song_id, name)
values (
  '00000000-0000-4000-8000-000000000502',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-000000000106',
  'Conferência'
);

insert into public.song_arrangement_versions (
  id,
  church_id,
  arrangement_id,
  version_number,
  format,
  content,
  original_key,
  bpm
)
values (
  '00000000-0000-4000-8000-000000000602',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-000000000502',
  3,
  'PLAIN',
  E'A D A E\n',
  'A',
  84
);

insert into public.setlist_items (
  id,
  church_id,
  event_id,
  song_id,
  position,
  key_override,
  notes,
  arrangement_id,
  arrangement_version_id
)
values
  (
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-0000000000e1',
    '00000000-0000-4000-8000-000000000101',
    1,
    'D',
    'Manter esta nota',
    null,
    null
  ),
  (
    '00000000-0000-4000-8000-000000000702',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-0000000000e1',
    '00000000-0000-4000-8000-000000000106',
    2,
    'B',
    'Versão já escolhida',
    '00000000-0000-4000-8000-000000000502',
    '00000000-0000-4000-8000-000000000602'
  ),
  (
    '00000000-0000-4000-8000-000000000703',
    '00000000-0000-4000-8000-0000000000b1',
    '00000000-0000-4000-8000-0000000000e2',
    '00000000-0000-4000-8000-000000000201',
    1,
    'C',
    'Tenant B',
    null,
    null
  );

\ir ../../supabase/migrations/20260825165929_backfill_song_arrangements.sql

do $$
declare
  v_main_arrangement uuid;
  v_main_version uuid;
begin
  select a.id
  into strict v_main_arrangement
  from public.song_arrangements a
  where a.church_id = '00000000-0000-4000-8000-0000000000a1'
    and a.song_id = '00000000-0000-4000-8000-000000000101'
    and lower(a.name) = lower('Arranjo principal');

  select v.id
  into strict v_main_version
  from public.song_arrangement_versions v
  where v.church_id = '00000000-0000-4000-8000-0000000000a1'
    and v.arrangement_id = v_main_arrangement
    and v.version_number = 1;

  if not exists (
    select 1
    from public.song_arrangement_versions v
    where v.id = v_main_version
      and v.format = 'PLAIN'
      and v.content = E'  [Verso]\nC   G\nLetra  \n'
      and v.original_key = 'C'
      and v.bpm = 72
      and v.metadata @> jsonb_build_object(
        'source', 'songs.chord_chart',
        'migration', 'backfill_song_arrangements'
      )
  ) then
    raise exception 'versão 1 não preservou conteúdo, tom, BPM ou metadata';
  end if;

  if not exists (
    select 1
    from public.songs s
    where s.id = '00000000-0000-4000-8000-000000000101'
      and s.default_arrangement_id = v_main_arrangement
      and s.chord_chart = E'  [Verso]\nC   G\nLetra  \n'
      and s.lyrics = 'Letra original'
  ) then
    raise exception 'default ou dados legados da música foram alterados incorretamente';
  end if;

  if not exists (
    select 1
    from public.setlist_items si
    where si.id = '00000000-0000-4000-8000-000000000701'
      and si.arrangement_id = v_main_arrangement
      and si.arrangement_version_id = v_main_version
      and si.key_override = 'D'
      and si.notes = 'Manter esta nota'
      and si.position = 1
  ) then
    raise exception 'setlist legado não foi vinculado ou perdeu dados';
  end if;

  if exists (
    select 1
    from public.song_arrangements a
    where a.song_id in (
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000103',
      '00000000-0000-4000-8000-000000000107'
    )
  ) or exists (
    select 1
    from public.songs s
    where s.id in (
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000103',
      '00000000-0000-4000-8000-000000000107'
    )
      and s.default_arrangement_id is not null
  ) then
    raise exception 'música sem cifra recebeu arranjo ou default';
  end if;

  if not exists (
    select 1
    from public.songs s
    join public.song_arrangements a
      on a.church_id = s.church_id
     and a.song_id = s.id
     and a.id = s.default_arrangement_id
    join public.song_arrangement_versions v
      on v.church_id = a.church_id
     and v.arrangement_id = a.id
     and v.version_number = 1
    where s.id = '00000000-0000-4000-8000-000000000104'
      and s.active = false
      and v.content = E'F C Dm Bb\n'
  ) then
    raise exception 'música arquivada não foi migrada';
  end if;

  if not exists (
    select 1
    from public.songs s
    where s.id = '00000000-0000-4000-8000-000000000105'
      and s.default_arrangement_id = '00000000-0000-4000-8000-000000000501'
  ) then
    raise exception 'default existente foi sobrescrito';
  end if;

  if not exists (
    select 1
    from public.setlist_items si
    where si.id = '00000000-0000-4000-8000-000000000702'
      and si.arrangement_id = '00000000-0000-4000-8000-000000000502'
      and si.arrangement_version_id = '00000000-0000-4000-8000-000000000602'
      and si.key_override = 'B'
      and si.notes = 'Versão já escolhida'
      and si.position = 2
  ) then
    raise exception 'seleção versionada existente foi sobrescrita';
  end if;

  if exists (
    select 1
    from public.song_arrangements a
    join public.songs s on s.id = a.song_id
    where a.church_id <> s.church_id
  ) or exists (
    select 1
    from public.setlist_items si
    join public.song_arrangements a on a.id = si.arrangement_id
    join public.song_arrangement_versions v on v.id = si.arrangement_version_id
    where si.church_id <> a.church_id
       or si.church_id <> v.church_id
       or si.song_id <> a.song_id
       or a.id <> v.arrangement_id
  ) then
    raise exception 'backfill criou referência cross-tenant ou cross-song';
  end if;

  if not exists (
    select 1
    from public.setlist_items si
    join public.song_arrangements a on a.id = si.arrangement_id
    where si.id = '00000000-0000-4000-8000-000000000703'
      and a.church_id = '00000000-0000-4000-8000-0000000000b1'
      and a.song_id = '00000000-0000-4000-8000-000000000201'
  ) then
    raise exception 'setlist da igreja B não recebeu seu próprio arranjo';
  end if;

  if exists (
    select 1
    from public.song_imports i
    where i.church_id in (
      '00000000-0000-4000-8000-0000000000a1',
      '00000000-0000-4000-8000-0000000000b1'
    )
  ) then
    raise exception 'backfill criou song_import artificial';
  end if;
end
$$;

create temporary table backfill_first_run_counts as
select
  (select count(*) from public.song_arrangements) as arrangements,
  (select count(*) from public.song_arrangement_versions) as versions,
  (select count(*) from public.setlist_items) as setlist_items;

-- Segunda execução: IDs, defaults, vínculos e quantidades devem permanecer.
\ir ../../supabase/migrations/20260825165929_backfill_song_arrangements.sql

do $$
begin
  if exists (
    select 1
    from backfill_first_run_counts c
    where c.arrangements <> (select count(*) from public.song_arrangements)
       or c.versions <> (select count(*) from public.song_arrangement_versions)
       or c.setlist_items <> (select count(*) from public.setlist_items)
  ) then
    raise exception 'reexecução duplicou ou removeu dados';
  end if;

  if exists (
    select 1
    from public.song_arrangements a
    where lower(a.name) = lower('Arranjo principal')
    group by a.church_id, a.song_id
    having count(*) <> 1
  ) then
    raise exception 'reexecução duplicou Arranjo principal';
  end if;

  if exists (
    select 1
    from public.song_arrangement_versions v
    join public.song_arrangements a on a.id = v.arrangement_id
    where lower(a.name) = lower('Arranjo principal')
      and v.version_number = 1
    group by v.arrangement_id
    having count(*) <> 1
  ) then
    raise exception 'reexecução duplicou version_number 1';
  end if;

  if not exists (
    select 1
    from public.songs s
    where s.id = '00000000-0000-4000-8000-000000000105'
      and s.default_arrangement_id = '00000000-0000-4000-8000-000000000501'
  ) or not exists (
    select 1
    from public.setlist_items si
    where si.id = '00000000-0000-4000-8000-000000000702'
      and si.arrangement_id = '00000000-0000-4000-8000-000000000502'
      and si.arrangement_version_id = '00000000-0000-4000-8000-000000000602'
  ) then
    raise exception 'reexecução sobrescreveu default ou setlist existente';
  end if;
end
$$;

rollback;
