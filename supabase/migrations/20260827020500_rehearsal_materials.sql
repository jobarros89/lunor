create table if not exists public.rehearsal_materials (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  arrangement_version_id uuid references public.song_arrangement_versions(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 120),
  category text not null default 'OTHER' check (category in ('VOCAL_SOPRANO','VOCAL_CONTRALTO','VOCAL_TENOR','VOCAL_OTHER','BASS','GUITAR','KEYS','DRUMS','CLICK','GUIDE','OTHER')),
  file_name text not null,
  storage_object_path text not null unique,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists rehearsal_materials_song_idx
  on public.rehearsal_materials (church_id, song_id, created_at desc);
create index if not exists rehearsal_materials_arrangement_version_idx
  on public.rehearsal_materials (arrangement_version_id)
  where arrangement_version_id is not null;

alter table public.rehearsal_materials enable row level security;

drop policy if exists rehearsal_materials_select on public.rehearsal_materials;
create policy rehearsal_materials_select
  on public.rehearsal_materials for select
  using (public.is_church_member(rehearsal_materials.church_id));

drop policy if exists rehearsal_materials_insert on public.rehearsal_materials;
create policy rehearsal_materials_insert
  on public.rehearsal_materials for insert
  with check (
    (
      public.is_louvor_leader(rehearsal_materials.church_id)
      or public.is_church_coord(rehearsal_materials.church_id)
    )
    and exists (
      select 1
      from public.songs s
      where s.id = rehearsal_materials.song_id
        and s.church_id = rehearsal_materials.church_id
    )
    and (
      rehearsal_materials.arrangement_version_id is null
      or exists (
        select 1
        from public.song_arrangement_versions sav
        join public.song_arrangements sa on sa.id = sav.arrangement_id
        where sav.id = rehearsal_materials.arrangement_version_id
          and sav.church_id = rehearsal_materials.church_id
          and sa.song_id = rehearsal_materials.song_id
          and sa.church_id = rehearsal_materials.church_id
      )
    )
  );

drop policy if exists rehearsal_materials_delete on public.rehearsal_materials;
create policy rehearsal_materials_delete
  on public.rehearsal_materials for delete
  using (
    public.is_louvor_leader(rehearsal_materials.church_id)
    or public.is_church_coord(rehearsal_materials.church_id)
  );

grant select, insert, delete on public.rehearsal_materials to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'worship-materials',
  'worship-materials',
  false,
  104857600,
  array[
    'audio/mpeg','audio/mp4','audio/aac','audio/x-aac','audio/wav','audio/x-wav',
    'audio/flac','audio/x-flac','audio/ogg','application/ogg','application/octet-stream'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists worship_materials_select on storage.objects;
create policy worship_materials_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'worship-materials'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.is_church_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists worship_materials_insert on storage.objects;
create policy worship_materials_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'worship-materials'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and (
      public.is_louvor_leader(((storage.foldername(name))[1])::uuid)
      or public.is_church_coord(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists worship_materials_delete on storage.objects;
create policy worship_materials_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'worship-materials'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and (
      public.is_louvor_leader(((storage.foldername(name))[1])::uuid)
      or public.is_church_coord(((storage.foldername(name))[1])::uuid)
    )
  );
