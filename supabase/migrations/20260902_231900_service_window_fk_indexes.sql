create index if not exists event_ministry_windows_ministry_idx
  on public.event_ministry_windows(ministry_id);

create index if not exists event_ministry_windows_created_by_idx
  on public.event_ministry_windows(created_by)
  where created_by is not null;
