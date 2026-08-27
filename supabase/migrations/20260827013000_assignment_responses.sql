alter type public.assignment_status add value if not exists 'falar_lider' after 'confirmado';

alter table public.assignments
  add column if not exists responded_at timestamptz,
  add column if not exists response_note text;

comment on column public.assignments.responded_at
  is 'Data e hora da última resposta do voluntário à escala.';
comment on column public.assignments.response_note
  is 'Observação opcional enviada pelo voluntário ao responder à escala.';

create or replace function public.guard_assignment_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_church_leader(new.church_id) then
    return new;
  end if;

  if new.user_id <> (select auth.uid()) or old.user_id <> (select auth.uid()) then
    raise exception 'not_allowed';
  end if;

  if to_jsonb(new) - 'status' - 'responded_at' - 'response_note' - 'updated_at'
     is distinct from
     to_jsonb(old) - 'status' - 'responded_at' - 'response_note' - 'updated_at' then
    raise exception 'only_response_change_allowed';
  end if;

  if not (
    (old.status = 'convidado' and new.status in ('confirmado', 'falar_lider', 'substituicao_solicitada'))
    or (old.status = 'confirmado' and new.status in ('falar_lider', 'substituicao_solicitada'))
    or (old.status = 'falar_lider' and new.status in ('confirmado', 'substituicao_solicitada'))
    or (old.status = 'substituicao_solicitada' and new.status = 'confirmado')
  ) then
    raise exception 'invalid_status_transition';
  end if;

  return new;
end;
$$;
