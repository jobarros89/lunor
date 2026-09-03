create table if not exists public.mcp_access_tokens (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_prefix text not null check (char_length(token_prefix) between 8 and 24),
  scopes text[] not null default array['read:operational']::text[],
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mcp_access_tokens_scope_check
    check (scopes = array['read:operational']::text[])
);

create index if not exists mcp_access_tokens_scope_idx
  on public.mcp_access_tokens(church_id, ministry_id, created_at desc);
create index if not exists mcp_access_tokens_creator_idx
  on public.mcp_access_tokens(created_by);

alter table public.mcp_access_tokens enable row level security;
revoke all on public.mcp_access_tokens from anon, authenticated;

create or replace function public.mcp_actor_can_manage(
  p_actor uuid,
  p_church uuid,
  p_ministry uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1 from public.platform_admins pa
      where pa.user_id = p_actor
    )
    or exists (
      select 1 from public.church_members cm
      where cm.user_id = p_actor
        and cm.church_id = p_church
        and cm.status = 'active'
        and cm.role in ('admin', 'coordenador')
    )
    or exists (
      select 1 from public.ministry_members mm
      where mm.user_id = p_actor
        and mm.church_id = p_church
        and mm.ministry_id = p_ministry
        and mm.active
        and mm.role in ('gerente', 'lider')
    );
$$;

revoke all on function public.mcp_actor_can_manage(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.create_mcp_access_token_record(
  p_church uuid,
  p_ministry uuid,
  p_name text,
  p_token_hash text,
  p_token_prefix text,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'unauthorized';
  end if;
  if not public.mcp_actor_can_manage(v_actor, p_church, p_ministry) then
    raise exception 'forbidden';
  end if;
  if not exists (
    select 1 from public.ministries m
    where m.id = p_ministry and m.church_id = p_church
  ) then
    raise exception 'invalid_scope';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_token_hash';
  end if;

  insert into public.mcp_access_tokens (
    church_id, ministry_id, created_by, name, token_hash, token_prefix, expires_at
  ) values (
    p_church,
    p_ministry,
    v_actor,
    left(trim(p_name), 80),
    p_token_hash,
    left(p_token_prefix, 24),
    p_expires_at
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.list_mcp_access_tokens(
  p_church uuid,
  p_ministry uuid
)
returns table (
  id uuid,
  name text,
  token_prefix text,
  scopes text[],
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;
  if not public.mcp_actor_can_manage(auth.uid(), p_church, p_ministry) then
    raise exception 'forbidden';
  end if;

  return query
  select
    t.id,
    t.name,
    t.token_prefix,
    t.scopes,
    t.expires_at,
    t.last_used_at,
    t.revoked_at,
    t.created_at
  from public.mcp_access_tokens t
  where t.church_id = p_church
    and t.ministry_id = p_ministry
  order by t.created_at desc;
end;
$$;

create or replace function public.revoke_mcp_access_token(p_token_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token public.mcp_access_tokens%rowtype;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select * into v_token
  from public.mcp_access_tokens
  where id = p_token_id;

  if not found then
    return false;
  end if;
  if not public.mcp_actor_can_manage(auth.uid(), v_token.church_id, v_token.ministry_id) then
    raise exception 'forbidden';
  end if;

  update public.mcp_access_tokens
  set revoked_at = coalesce(revoked_at, now())
  where id = p_token_id;
  return true;
end;
$$;

create or replace function public.mcp_token_context(p_token_hash text)
returns table (
  token_id uuid,
  church_id uuid,
  ministry_id uuid,
  ministry_name text,
  created_by uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.id, t.church_id, t.ministry_id, m.name, t.created_by
  from public.mcp_access_tokens t
  join public.ministries m
    on m.id = t.ministry_id and m.church_id = t.church_id
  where t.token_hash = p_token_hash
    and t.revoked_at is null
    and (t.expires_at is null or t.expires_at > now())
    and t.scopes @> array['read:operational']::text[]
    and public.mcp_actor_can_manage(t.created_by, t.church_id, t.ministry_id)
  limit 1;
$$;

revoke all on function public.mcp_token_context(text) from public, anon, authenticated;

create or replace function public.mcp_validate_access_token(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ctx record;
begin
  select * into v_ctx from public.mcp_token_context(p_token_hash);
  if not found then
    return null;
  end if;

  update public.mcp_access_tokens
  set last_used_at = now()
  where id = v_ctx.token_id;

  return jsonb_build_object(
    'tokenId', v_ctx.token_id,
    'churchId', v_ctx.church_id,
    'ministryId', v_ctx.ministry_id,
    'ministryName', v_ctx.ministry_name,
    'scope', 'read:operational'
  );
end;
$$;

create or replace function public.mcp_event_availability_json(
  p_church uuid,
  p_ministry uuid,
  p_event uuid,
  p_ministry_name text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with ev as (
    select
      e.id,
      e.title,
      e.starts_at,
      e.campus_id,
      case
        when e.service_period in ('morning', 'afternoon', 'evening') then e.service_period
        else 'all_day'
      end as resolved_period
    from public.events e
    where e.id = p_event and e.church_id = p_church
  ), members as (
    select mm.user_id, mm.role::text as role, p.full_name
    from public.ministry_members mm
    join public.profiles p on p.id = mm.user_id
    where mm.church_id = p_church
      and mm.ministry_id = p_ministry
      and mm.active
  ), resolved as (
    select
      m.user_id,
      m.full_name,
      m.role,
      coalesce(direct.status, cal.status, rec.status) as status,
      case
        when direct.status is not null then 'event'
        when cal.status is not null then cal.source
        when rec.status is not null then rec.source
        else null
      end as source
    from members m
    cross join ev e
    left join lateral (
      select ma.status
      from public.member_availability ma
      where ma.church_id = p_church
        and ma.ministry_id = p_ministry
        and ma.event_id = e.id
        and ma.user_id = m.user_id
      order by ma.updated_at desc
      limit 1
    ) direct on true
    left join lateral (
      select
        c.status,
        case when c.ministry_id is null then 'general_calendar' else 'ministry_calendar' end as source
      from public.member_availability_calendar c
      where direct.status is null
        and c.church_id = p_church
        and c.user_id = m.user_id
        and c.availability_date = (e.starts_at at time zone 'UTC')::date
        and (c.ministry_id = p_ministry or c.ministry_id is null)
        and (
          (e.campus_id is null and c.campus_id is null)
          or (e.campus_id is not null and (c.campus_id = e.campus_id or c.campus_id is null))
        )
        and (c.period = 'all_day' or (e.resolved_period <> 'all_day' and c.period = e.resolved_period))
      order by
        (c.ministry_id is not null) desc,
        (e.campus_id is not null and c.campus_id = e.campus_id) desc,
        (e.resolved_period <> 'all_day' and c.period = e.resolved_period) desc,
        c.updated_at desc
      limit 1
    ) cal on true
    left join lateral (
      select
        r.status,
        case when r.ministry_id is null then 'general_recurring' else 'ministry_recurring' end as source
      from public.member_availability_recurring r
      where direct.status is null
        and cal.status is null
        and r.church_id = p_church
        and r.user_id = m.user_id
        and r.weekday = extract(dow from e.starts_at at time zone 'UTC')::smallint
        and (r.ministry_id = p_ministry or r.ministry_id is null)
        and (
          (e.campus_id is null and r.campus_id is null)
          or (e.campus_id is not null and (r.campus_id = e.campus_id or r.campus_id is null))
        )
        and (r.period = 'all_day' or (e.resolved_period <> 'all_day' and r.period = e.resolved_period))
      order by
        (r.ministry_id is not null) desc,
        (e.campus_id is not null and r.campus_id = e.campus_id) desc,
        (e.resolved_period <> 'all_day' and r.period = e.resolved_period) desc,
        r.updated_at desc
      limit 1
    ) rec on true
  )
  select case
    when not exists (select 1 from ev) then null
    else jsonb_build_object(
      'event', (
        select jsonb_build_object('id', id, 'title', title, 'startsAt', starts_at)
        from ev
      ),
      'ministry', p_ministry_name,
      'people', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'userId', r.user_id,
            'name', r.full_name,
            'role', r.role,
            'status', r.status,
            'statusLabel', case
              when r.status = 'available' then 'Disponível'
              when r.status = 'unavailable' then 'Indisponível'
              else 'Sem resposta'
            end,
            'source', r.source
          ) order by r.full_name
        )
        from resolved r
      ), '[]'::jsonb)
    )
  end;
$$;

revoke all on function public.mcp_event_availability_json(uuid, uuid, uuid, text) from public, anon, authenticated;

create or replace function public.mcp_event_team_json(
  p_church uuid,
  p_ministry uuid,
  p_event uuid,
  p_ministry_name text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with ev as (
    select e.id, e.title, e.starts_at, e.ends_at
    from public.events e
    where e.id = p_event and e.church_id = p_church
  ), team_window as (
    select w.arrival_at, w.release_at
    from public.event_ministry_windows w
    where w.church_id = p_church
      and w.ministry_id = p_ministry
      and w.event_id = p_event
    limit 1
  )
  select case
    when not exists (select 1 from ev) then null
    else jsonb_build_object(
      'event', (
        select jsonb_build_object('id', id, 'title', title, 'startsAt', starts_at)
        from ev
      ),
      'ministry', p_ministry_name,
      'people', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'assignmentId', a.id,
            'userId', a.user_id,
            'name', coalesce(p.full_name, 'Sem nome'),
            'roleName', a.role_name,
            'status', a.status::text,
            'statusLabel', case a.status::text
              when 'convidado' then 'Aguardando confirmação'
              when 'confirmado' then 'Confirmado'
              when 'falar_lider' then 'Quer falar com o líder'
              when 'substituicao_solicitada' then 'Não pode servir'
              when 'ausente' then 'Ausente'
              when 'presente' then 'Presente'
              else a.status::text
            end,
            'arrival', to_char(
              coalesce(a.arrival_time, tw.arrival_at, e.starts_at) at time zone 'UTC',
              'HH24:MI'
            ),
            'release', case
              when coalesce(a.release_time, tw.release_at, e.ends_at) is null then null
              else to_char(
                coalesce(a.release_time, tw.release_at, e.ends_at) at time zone 'UTC',
                'HH24:MI'
              )
            end
          ) order by a.created_at
        )
        from public.assignments a
        join ev e on e.id = a.event_id
        left join team_window tw on true
        left join public.profiles p on p.id = a.user_id
        where a.church_id = p_church
          and a.ministry_id = p_ministry
          and a.event_id = p_event
          and a.status::text <> 'substituido'
      ), '[]'::jsonb)
    )
  end;
$$;

revoke all on function public.mcp_event_team_json(uuid, uuid, uuid, text) from public, anon, authenticated;

create or replace function public.mcp_operational_summary_json(
  p_church uuid,
  p_ministry uuid,
  p_ministry_name text,
  p_limit integer default 4
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with ev as (
    select e.id, e.title, e.starts_at
    from public.events e
    where e.church_id = p_church
      and e.starts_at >= now()
    order by e.starts_at
    limit least(greatest(coalesce(p_limit, 4), 1), 8)
  ), member_count as (
    select count(*)::int as total
    from public.ministry_members mm
    where mm.church_id = p_church
      and mm.ministry_id = p_ministry
      and mm.active
  ), detail as (
    select
      e.id,
      e.title,
      e.starts_at,
      public.mcp_event_availability_json(p_church, p_ministry, e.id, p_ministry_name) as availability_json,
      (select count(*)::int from public.assignments a where a.church_id=p_church and a.ministry_id=p_ministry and a.event_id=e.id and a.status::text <> 'substituido') as assignment_total,
      (select count(*)::int from public.assignments a where a.church_id=p_church and a.ministry_id=p_ministry and a.event_id=e.id and a.status::text in ('confirmado','presente')) as confirmed,
      (select count(*)::int from public.assignments a where a.church_id=p_church and a.ministry_id=p_ministry and a.event_id=e.id and a.status::text='convidado') as awaiting,
      (select count(*)::int from public.assignments a where a.church_id=p_church and a.ministry_id=p_ministry and a.event_id=e.id and a.status::text='falar_lider') as wants_leader,
      (select count(*)::int from public.assignments a where a.church_id=p_church and a.ministry_id=p_ministry and a.event_id=e.id and a.status::text='substituicao_solicitada') as substitution_needed,
      (select count(*)::int from public.assignments a where a.church_id=p_church and a.ministry_id=p_ministry and a.event_id=e.id and a.status::text='ausente') as absent
    from ev e
  ), enriched as (
    select d.*,
      coalesce((select count(*)::int from jsonb_array_elements(d.availability_json->'people') p where p->>'status'='available'),0) as available,
      coalesce((select count(*)::int from jsonb_array_elements(d.availability_json->'people') p where p->>'status'='unavailable'),0) as unavailable,
      coalesce((select count(*)::int from jsonb_array_elements(d.availability_json->'people') p where p->>'status' is null),0) as unknown,
      coalesce((
        select count(distinct a.user_id)::int
        from public.assignments a
        where a.church_id=p_church
          and a.ministry_id=p_ministry
          and a.event_id=d.id
          and a.status::text <> 'substituido'
          and exists (
            select 1
            from jsonb_array_elements(d.availability_json->'people') p
            where p->>'userId'=a.user_id::text and p->>'status'='unavailable'
          )
      ),0) as assigned_unavailable
    from detail d
  ), summaries as (
    select
      en.*,
      case
        when en.assignment_total = 0 then 'no_assignments'
        when en.awaiting + en.wants_leader + en.substitution_needed + en.absent > 0
          or en.assigned_unavailable > 0 then 'attention'
        else 'ready'
      end as readiness,
      jsonb_build_object(
        'id', en.id,
        'title', en.title,
        'startsAt', en.starts_at,
        'readiness', case
          when en.assignment_total = 0 then 'no_assignments'
          when en.awaiting + en.wants_leader + en.substitution_needed + en.absent > 0
            or en.assigned_unavailable > 0 then 'attention'
          else 'ready'
        end,
        'assignments', jsonb_build_object(
          'total', en.assignment_total,
          'confirmed', en.confirmed,
          'awaitingConfirmation', en.awaiting,
          'wantsLeader', en.wants_leader,
          'substitutionNeeded', en.substitution_needed,
          'absent', en.absent,
          'assignedUnavailable', en.assigned_unavailable
        ),
        'availability', jsonb_build_object(
          'totalMembers', (select total from member_count),
          'available', en.available,
          'unavailable', en.unavailable,
          'unknown', en.unknown
        )
      ) as summary
    from enriched en
  )
  select jsonb_build_object(
    'contractVersion', 1,
    'generatedAt', now(),
    'scope', jsonb_build_object('ministryId', p_ministry, 'ministryName', p_ministry_name),
    'totals', jsonb_build_object(
      'upcomingEvents', (select count(*)::int from summaries),
      'activeMembers', (select total from member_count),
      'assignments', coalesce((select sum(assignment_total)::int from summaries),0),
      'confirmedAssignments', coalesce((select sum(confirmed)::int from summaries),0),
      'eventsReady', (select count(*)::int from summaries where readiness='ready'),
      'eventsAttention', (select count(*)::int from summaries where readiness='attention'),
      'eventsWithoutAssignments', (select count(*)::int from summaries where readiness='no_assignments')
    ),
    'events', coalesce((select jsonb_agg(summary order by starts_at) from summaries), '[]'::jsonb)
  );
$$;

revoke all on function public.mcp_operational_summary_json(uuid, uuid, text, integer) from public, anon, authenticated;

create or replace function public.mcp_external_execute(
  p_token_hash text,
  p_tool_name text,
  p_args jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ctx record;
  v_event uuid;
  v_limit integer := 4;
  v_result jsonb;
begin
  select * into v_ctx from public.mcp_token_context(p_token_hash);
  if not found then
    raise exception 'invalid_mcp_token';
  end if;

  if p_tool_name = 'get_operational_summary' then
    if p_args ? 'limit' then
      v_limit := least(greatest((p_args->>'limit')::integer, 1), 8);
    end if;
    v_result := public.mcp_operational_summary_json(
      v_ctx.church_id, v_ctx.ministry_id, v_ctx.ministry_name, v_limit
    );
  elsif p_tool_name in ('get_event_team', 'get_event_availability') then
    if not (p_args ? 'eventId') then
      raise exception 'event_id_required';
    end if;
    v_event := (p_args->>'eventId')::uuid;
    if p_tool_name = 'get_event_team' then
      v_result := public.mcp_event_team_json(
        v_ctx.church_id, v_ctx.ministry_id, v_event, v_ctx.ministry_name
      );
    else
      v_result := public.mcp_event_availability_json(
        v_ctx.church_id, v_ctx.ministry_id, v_event, v_ctx.ministry_name
      );
    end if;
    if v_result is null then
      raise exception 'event_not_found';
    end if;
  else
    raise exception 'unknown_tool';
  end if;

  update public.mcp_access_tokens
  set last_used_at = now()
  where id = v_ctx.token_id;

  return v_result;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'invalid_tool_arguments';
end;
$$;

revoke all on function public.create_mcp_access_token_record(uuid, uuid, text, text, text, timestamptz) from public, anon;
revoke all on function public.list_mcp_access_tokens(uuid, uuid) from public, anon;
revoke all on function public.revoke_mcp_access_token(uuid) from public, anon;
revoke all on function public.mcp_validate_access_token(text) from public;
revoke all on function public.mcp_external_execute(text, text, jsonb) from public;

grant execute on function public.create_mcp_access_token_record(uuid, uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.list_mcp_access_tokens(uuid, uuid) to authenticated;
grant execute on function public.revoke_mcp_access_token(uuid) to authenticated;
grant execute on function public.mcp_validate_access_token(text) to anon, authenticated;
grant execute on function public.mcp_external_execute(text, text, jsonb) to anon, authenticated;

comment on table public.mcp_access_tokens is
  'Credenciais MCP externas escopadas a uma igreja + ministério. Apenas hash do token é persistido.';
comment on function public.mcp_external_execute(text, text, jsonb) is
  'Executor MCP externo estritamente read-only. O escopo é derivado do token, nunca de parâmetros do cliente.';
