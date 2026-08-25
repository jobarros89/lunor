-- Confirma uma importação e sua versão como uma única transação. A igreja é
-- obtida da música no banco, nunca de um identificador enviado pelo cliente.
create or replace function public.confirm_chord_import(
  p_song_id uuid,
  p_arrangement_id uuid,
  p_arrangement_name text,
  p_source_kind text,
  p_source_format text,
  p_original_filename text,
  p_mime_type text,
  p_raw_content text,
  p_chordpro_content text,
  p_metadata jsonb,
  p_warnings jsonb
) returns table(import_id uuid, arrangement_id uuid, version_id uuid, version_number integer)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_church uuid;
  v_arrangement uuid;
  v_import uuid;
  v_version uuid;
  v_number integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_raw_content is null or char_length(p_raw_content) > 20000 then
    raise exception 'INVALID_RAW_CONTENT' using errcode = '22001';
  end if;
  if p_chordpro_content is null or char_length(btrim(p_chordpro_content)) not between 1 and 20000 then
    raise exception 'INVALID_CHORDPRO_CONTENT' using errcode = '22001';
  end if;
  if p_source_kind not in ('PASTE', 'FILE') or p_source_format not in ('PLAIN', 'CHORDPRO') then
    raise exception 'INVALID_SOURCE' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_warnings, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_PARSER_RESULT' using errcode = '22023';
  end if;

  select s.church_id into v_church
  from public.songs s where s.id = p_song_id for update;
  if v_church is null then raise exception 'SONG_NOT_FOUND' using errcode = 'P0002'; end if;
  if not (public.is_louvor_leader(v_church) or public.is_church_coord(v_church)) then
    raise exception 'IMPORT_FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.song_imports (
    church_id, song_id, source_kind, source_format, original_filename,
    mime_type, raw_content, parser_version, detected_metadata, warnings,
    status, created_by
  ) values (
    v_church, p_song_id, p_source_kind, p_source_format,
    nullif(btrim(p_original_filename), ''), nullif(btrim(p_mime_type), ''),
    p_raw_content, '2.0.0', coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_warnings, '[]'::jsonb), 'RECEIVED', v_user
  ) returning id into v_import;

  if p_arrangement_id is null then
    if char_length(btrim(coalesce(p_arrangement_name, ''))) not between 1 and 120 then
      raise exception 'INVALID_ARRANGEMENT_NAME' using errcode = '22023';
    end if;
    insert into public.song_arrangements (church_id, song_id, name, created_by)
    values (v_church, p_song_id, btrim(p_arrangement_name), v_user)
    returning id into v_arrangement;
  else
    select a.id into v_arrangement from public.song_arrangements a
    where a.id = p_arrangement_id and a.church_id = v_church
      and a.song_id = p_song_id and a.active
    for update;
    if v_arrangement is null then
      raise exception 'ARRANGEMENT_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;

  select coalesce(max(v.version_number), 0) + 1 into v_number
  from public.song_arrangement_versions v where v.arrangement_id = v_arrangement;
  insert into public.song_arrangement_versions (
    church_id, arrangement_id, version_number, format, content, original_key,
    bpm, time_signature, metadata, created_by
  ) values (
    v_church, v_arrangement, v_number, 'CHORDPRO', p_chordpro_content,
    nullif(p_metadata->>'key', ''), nullif(p_metadata->>'bpm', '')::integer,
    nullif(p_metadata->>'timeSignature', ''), coalesce(p_metadata, '{}'::jsonb), v_user
  ) returning id into v_version;

  update public.song_imports set arrangement_id = v_arrangement,
    resulting_version_id = v_version, status = 'CONFIRMED'
  where id = v_import;
  update public.songs set default_arrangement_id = v_arrangement
  where id = p_song_id and default_arrangement_id is null;

  return query select v_import, v_arrangement, v_version, v_number;
end;
$$;

revoke all on function public.confirm_chord_import(uuid, uuid, text, text, text, text, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.confirm_chord_import(uuid, uuid, text, text, text, text, text, text, text, jsonb, jsonb) to authenticated;
