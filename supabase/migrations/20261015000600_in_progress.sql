-- "In progress" tracking: a coach (or a board member) can mark a requirement as started, for example after
-- applying for a clearance and waiting for the certificate. It is a visibility signal only: it never counts toward
-- "Cleared to Coach" and never enters the review queue. Uploading the real document clears it automatically.
-- Do not store clearance numbers or other identifiers in the note.

create table public.progress (
  coach_id       uuid not null references public.coaches(id) on delete cascade,
  requirement_id text not null references public.requirements(id) on delete cascade,
  started_on     date not null,
  follow_up_on   date,
  note           text check (char_length(note) <= 300),
  updated_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (coach_id, requirement_id),
  check (follow_up_on is null or follow_up_on >= started_on)
);
alter table public.progress enable row level security;
revoke all on public.progress from anon, authenticated;
grant select on public.progress to authenticated;

-- Read-only from the browser: board sees all, a coach sees their own. Writes go through the functions below.
create policy progress_read on public.progress for select to authenticated
  using ((select private.is_board()) or (select private.is_coach(progress.coach_id)));

create or replace function public.mark_in_progress(
  p_coach_id uuid, p_requirement_id text, p_started_on date, p_follow_up_on date default null, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  req jsonb;
  c public.coaches;
begin
  if not (private.is_board() or private.is_coach(p_coach_id)) then
    raise exception 'You do not have access to update this.' using errcode = 'P0001';
  end if;
  select * into c from public.coaches where id = p_coach_id;
  if c.id is null then raise exception 'Coach not found.' using errcode = 'P0001'; end if;
  select definition into req from public.requirements where id = p_requirement_id;
  if req is null then raise exception 'Requirement not found.' using errcode = 'P0001'; end if;
  if coalesce((req->>'active')::boolean, true) is not true
     or not ((req->'appliesToRoles') ? c.role and (req->'appliesToPay') ? c.pay) then
    raise exception 'This requirement does not apply to this coach.' using errcode = 'P0001';
  end if;
  if p_started_on is null then raise exception 'Enter the date you started.' using errcode = 'P0001'; end if;
  if p_started_on < date '2000-01-01' then raise exception 'That start date looks wrong.' using errcode = 'P0001'; end if;
  if p_started_on > ((now() at time zone 'utc')::date + 1) then
    raise exception 'The start date cannot be in the future.' using errcode = 'P0001';
  end if;
  if p_follow_up_on is not null and p_follow_up_on < p_started_on then
    raise exception 'The follow-up date cannot be before the start date.' using errcode = 'P0001';
  end if;
  if p_follow_up_on is not null and p_follow_up_on > ((now() at time zone 'utc')::date + 730) then
    raise exception 'That follow-up date looks wrong.' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_note, '')) > 300 then
    raise exception 'Keep the note to 300 characters or fewer.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.submissions s
              where s.coach_id = p_coach_id and s.requirement_id = p_requirement_id and s.status = 'pending') then
    raise exception 'A document is already waiting for board review.' using errcode = 'P0001';
  end if;

  insert into public.progress as p (coach_id, requirement_id, started_on, follow_up_on, note, updated_by)
  values (p_coach_id, p_requirement_id, p_started_on, p_follow_up_on, nullif(btrim(coalesce(p_note, '')), ''), (select auth.uid()))
  on conflict (coach_id, requirement_id) do update
     set started_on = excluded.started_on, follow_up_on = excluded.follow_up_on, note = excluded.note,
         updated_by = excluded.updated_by, updated_at = now();
end $$;

create or replace function public.clear_in_progress(p_coach_id uuid, p_requirement_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (private.is_board() or private.is_coach(p_coach_id)) then
    raise exception 'You do not have access to update this.' using errcode = 'P0001';
  end if;
  delete from public.progress where coach_id = p_coach_id and requirement_id = p_requirement_id;
end $$;

revoke all on function public.mark_in_progress(uuid, text, date, date, text) from public, anon;
revoke all on function public.clear_in_progress(uuid, text) from public, anon;
grant execute on function public.mark_in_progress(uuid, text, date, date, text) to authenticated;
grant execute on function public.clear_in_progress(uuid, text) to authenticated;

-- Once a document or signature is submitted for the requirement, the "started" marker is no longer needed.
create or replace function public.progress_clear_on_submission()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.progress where coach_id = new.coach_id and requirement_id = new.requirement_id;
  return null;
end $$;
revoke all on function public.progress_clear_on_submission() from public, anon, authenticated;

create trigger submissions_clear_progress after insert on public.submissions
  for each row execute function public.progress_clear_on_submission();
