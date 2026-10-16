-- Internal inbox messages + automatic service reminders.
-- Leaders can message members inside the ministries they manage.
-- Service reminders are created in the inbox and returned to the cron route
-- for Web Push + e-mail delivery.

create table public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  ministry_id uuid references public.ministries(id) on delete set null,
  sender_id uuid references public.profiles(id) on delete set null,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'direct'
    check (kind in ('direct', 'service_reminder')),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 3000),
  event_id uuid references public.events(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete cascade,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint inbox_messages_direct_sender
    check (kind <> 'direct' or sender_id is not null)
);

create index inbox_messages_recipient_idx
  on public.inbox_messages(recipient_id, created_at desc);
create index inbox_messages_sender_idx
  on public.inbox_messages(sender_id, created_at desc)
  where sender_id is not null;
create index inbox_messages_church_idx
  on public.inbox_messages(church_id, created_at desc);
create unique index inbox_messages_dedupe_idx
  on public.inbox_messages(dedupe_key)
  where dedupe_key is not null;

alter table public.inbox_messages enable row level security;

create policy inbox_messages_select
  on public.inbox_messages
  for select
  using (
    recipient_id = auth.uid()
    or sender_id = auth.uid()
    or public.is_platform_admin()
  );

create policy inbox_messages_recipient_update
  on public.inbox_messages
  for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

grant select on public.inbox_messages to authenticated;
grant update(read_at) on public.inbox_messages to authenticated;

-- Returns true when the current user is allowed to send a direct message to
-- the requested member in the requested ministry. Global church coordinators
-- may message any active member. Ministry leaders/managers are scoped to the
-- ministries (and, when applicable, campuses) they administrate.
create or replace function public.can_message_ministry_member(
  p_church uuid,
  p_ministry uuid,
  p_recipient uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and auth.uid() <> p_recipient
    and exists (
      select 1
      from church_members recipient_church
      where recipient_church.church_id = p_church
        and recipient_church.user_id = p_recipient
        and recipient_church.status = 'active'
    )
    and (
      public.is_church_coord(p_church)
      or (
        p_ministry is not null
        and exists (
          select 1
          from ministry_members recipient_membership
          where recipient_membership.church_id = p_church
            and recipient_membership.ministry_id = p_ministry
            and recipient_membership.user_id = p_recipient
            and recipient_membership.active
        )
        and exists (
          select 1
          from ministry_admin_permissions permission
          where permission.church_id = p_church
            and permission.ministry_id = p_ministry
            and permission.user_id = auth.uid()
            and permission.role in ('gerente', 'lider')
            and (
              permission.campus_id is null
              or not exists (
                select 1
                from ministry_member_campuses target_scope
                where target_scope.ministry_id = p_ministry
                  and target_scope.user_id = p_recipient
              )
              or exists (
                select 1
                from ministry_member_campuses target_scope
                where target_scope.ministry_id = p_ministry
                  and target_scope.user_id = p_recipient
                  and target_scope.campus_id = permission.campus_id
              )
            )
        )
      )
    );
$$;

revoke all on function public.can_message_ministry_member(uuid, uuid, uuid) from public;
grant execute on function public.can_message_ministry_member(uuid, uuid, uuid) to authenticated;

create or replace function public.send_inbox_message(
  p_church uuid,
  p_ministry uuid,
  p_recipient uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id uuid;
  v_sender_name text;
  v_body text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_body := btrim(coalesce(p_body, ''));
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then
    raise exception 'invalid_message_length';
  end if;

  if not public.can_message_ministry_member(p_church, p_ministry, p_recipient) then
    raise exception 'message_not_allowed';
  end if;

  select full_name into v_sender_name
  from profiles
  where id = auth.uid();

  insert into inbox_messages (
    church_id,
    ministry_id,
    sender_id,
    recipient_id,
    kind,
    title,
    body
  )
  values (
    p_church,
    p_ministry,
    auth.uid(),
    p_recipient,
    'direct',
    coalesce(nullif(v_sender_name, ''), 'Liderança'),
    v_body
  )
  returning id into v_message_id;

  return v_message_id;
end;
$$;

revoke all on function public.send_inbox_message(uuid, uuid, uuid, text) from public;
grant execute on function public.send_inbox_message(uuid, uuid, uuid, text) to authenticated;

-- Cron-only RPC. It inserts the in-app reminder first and returns exactly the
-- newly-created reminders, including push subscriptions as JSON.
--
-- Schedule:
--   * Sunday services: Saturday at 19:00 America/Sao_Paulo.
--   * Other services: one day before at 20:00 America/Sao_Paulo.
--
-- This reconciles the two requested reminder windows without sending twice.
create or replace function public.service_reminders_due(p_secret text)
returns table (
  message_id uuid,
  user_id uuid,
  assignment_id uuid,
  titulo text,
  corpo text,
  url text,
  push_targets jsonb
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_agora timestamp;
  v_hoje date;
  v_hora integer;
  v_dow integer;
begin
  if p_secret is null
    or not exists (select 1 from cron_secret where secret = p_secret)
  then
    raise exception 'não autorizado';
  end if;

  v_agora := now() at time zone 'America/Sao_Paulo';
  v_hoje := v_agora::date;
  v_hora := extract(hour from v_agora)::integer;
  v_dow := extract(dow from v_agora)::integer;

  return query
  with candidatos as (
    select
      a.id as assignment_id,
      a.user_id,
      a.church_id,
      a.ministry_id,
      a.role_name,
      e.id as event_id,
      e.title as event_title,
      e.starts_at,
      e.setlist_status,
      c.slug as church_slug,
      coalesce(a.arrival_time, emw.arrival_at, e.starts_at) as arrival_at,
      (
        select string_agg(s.title, ' • ' order by si.position)
        from setlist_items si
        join songs s on s.id = si.song_id
        where si.event_id = e.id
          and si.church_id = e.church_id
          and e.setlist_status = 'publicado'
      ) as setlist_titles
    from assignments a
    join events e
      on e.id = a.event_id
     and e.church_id = a.church_id
    join churches c on c.id = a.church_id
    left join event_ministry_windows emw
      on emw.event_id = a.event_id
     and emw.ministry_id = a.ministry_id
    where a.status in ('convidado', 'confirmado')
      and (
        (
          -- Sunday service -> Saturday at 19:00.
          v_dow = 6
          and v_hora = 19
          and ((e.starts_at at time zone 'America/Sao_Paulo')::date) = v_hoje + 1
          and extract(dow from e.starts_at at time zone 'America/Sao_Paulo')::integer = 0
        )
        or (
          -- All other service days -> previous day at 20:00.
          v_hora = 20
          and ((e.starts_at at time zone 'America/Sao_Paulo')::date) = v_hoje + 1
          and extract(dow from e.starts_at at time zone 'America/Sao_Paulo')::integer <> 0
        )
      )
  ),
  preparados as (
    select
      c.*,
      'Lembrete da sua escala'::text as titulo,
      (
        c.event_title
        || E'\nChegada: '
        || to_char(c.arrival_at at time zone 'America/Sao_Paulo', 'HH24:MI')
        || E'\nFunção: '
        || c.role_name
        || E'\nRepertório: '
        || coalesce(nullif(c.setlist_titles, ''), case when c.setlist_status = 'rascunho' then 'ainda não publicado' else 'não informado' end)
      )::text as corpo,
      ('/' || c.church_slug || '/escalas/' || c.event_id)::text as url,
      (
        'service_reminder:'
        || c.assignment_id::text
        || ':'
        || ((c.starts_at at time zone 'America/Sao_Paulo')::date)::text
      )::text as dedupe_key
    from candidatos c
  ),
  inseridos as (
    insert into inbox_messages (
      church_id,
      ministry_id,
      sender_id,
      recipient_id,
      kind,
      title,
      body,
      event_id,
      assignment_id,
      dedupe_key
    )
    select
      p.church_id,
      p.ministry_id,
      null,
      p.user_id,
      'service_reminder',
      p.titulo,
      p.corpo,
      p.event_id,
      p.assignment_id,
      p.dedupe_key
    from preparados p
    on conflict (dedupe_key) where dedupe_key is not null do nothing
    returning
      inbox_messages.id,
      inbox_messages.recipient_id,
      inbox_messages.assignment_id,
      inbox_messages.title,
      inbox_messages.body,
      inbox_messages.event_id
  )
  select
    i.id as message_id,
    i.recipient_id as user_id,
    i.assignment_id,
    i.title as titulo,
    i.body as corpo,
    '/' || c.slug || '/escalas/' || i.event_id as url,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', ps.id,
            'endpoint', ps.endpoint,
            'p256dh', ps.p256dh,
            'auth', ps.auth
          )
        )
        from push_subscriptions ps
        where ps.user_id = i.recipient_id
          and ps.church_id = p.church_id
      ),
      '[]'::jsonb
    ) as push_targets
  from inseridos i
  join preparados p on p.assignment_id = i.assignment_id
  join churches c on c.id = p.church_id;
end;
$$;

revoke all on function public.service_reminders_due(text) from public;
grant execute on function public.service_reminders_due(text) to anon, authenticated;
