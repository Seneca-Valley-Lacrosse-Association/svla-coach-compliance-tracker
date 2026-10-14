-- 1) Archive a coach record instead of deleting it.
--    An archived coach keeps every submission and file, but is hidden from the active roster, stops counting in the
--    dashboard, and can no longer sign in to anything (private.is_coach returns false). Restore clears the flag.
alter table public.coaches add column if not exists archived_at timestamptz;

create or replace function private.is_coach(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coaches c
                 where c.id = target and c.status = 'approved' and c.archived_at is null
                   and lower(c.email) = private.confirmed_email())
$$;

-- 2) Board members can correct a submission's dates (for example a coach typed the wrong completion date).
--    Every correction is written to submissions.edit_log (who, when, old and new dates, reason) and is shown in the app
--    and in the Excel export. Status, review decision and the uploaded file never change.
alter table public.submissions add column if not exists edit_log jsonb not null default '[]'::jsonb;

create or replace function public.submissions_before_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Date correction made through public.admin_edit_submission: only dates, details and the audit log may change.
  if current_setting('svla.admin_edit', true) = 'on' then
    if (new.id, new.coach_id, new.requirement_id, new.status, new.uploaded_at, new.file_path, new.file_name,
        new.submitted_by, new.review_comment, new.reviewed_on, new.reviewed_by)
       is distinct from
       (old.id, old.coach_id, old.requirement_id, old.status, old.uploaded_at, old.file_path, old.file_name,
        old.submitted_by, old.review_comment, old.reviewed_on, old.reviewed_by) then
      raise exception 'Only dates can be corrected.';
    end if;
    return new;
  end if;

  if old.status <> 'pending' then raise exception 'This submission has already been reviewed.'; end if;
  if new.status not in ('approved','rejected') then raise exception 'Choose approve or reject.'; end if;
  if new.status = 'rejected' and btrim(coalesce(new.review_comment,'')) = '' then
    raise exception 'A rejection reason is required.';
  end if;
  if (new.id, new.coach_id, new.requirement_id, new.completed_on, new.expires_on, new.file_path, new.file_name,
      new.details, new.uploaded_at, new.submitted_by)
     is distinct from
     (old.id, old.coach_id, old.requirement_id, old.completed_on, old.expires_on, old.file_path, old.file_name,
      old.details, old.uploaded_at, old.submitted_by) then
    raise exception 'Only the review decision can be changed.';
  end if;
  new.reviewed_on := (now() at time zone 'America/New_York')::date;
  new.reviewed_by := (select auth.uid());
  return new;
end $$;

create or replace function public.admin_edit_submission(
  p_id uuid, p_completed_on date, p_membership_expiry date default null, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  req jsonb;
  v jsonb;
  kind text;
  new_exp date;
  v_email text := private.confirmed_email();
begin
  if not private.is_board() then raise exception 'Board access is required.' using errcode = 'P0001'; end if;
  if p_completed_on is null then raise exception 'Enter the completion date.' using errcode = 'P0001'; end if;
  if p_completed_on > ((now() at time zone 'utc')::date + 1) then
    raise exception 'The completion date cannot be in the future.' using errcode = 'P0001';
  end if;
  if p_completed_on < date '2000-01-01' then raise exception 'That completion date looks wrong.' using errcode = 'P0001'; end if;

  select * into s from public.submissions where id = p_id for update;
  if s.id is null then raise exception 'Submission not found.' using errcode = 'P0001'; end if;
  select definition into req from public.requirements where id = s.requirement_id;

  v := req->'validity';
  kind := v->>'kind';
  if kind = 'membership' then
    if p_membership_expiry is null then raise exception 'Enter the membership expiration date.' using errcode = 'P0001'; end if;
    if p_membership_expiry < p_completed_on then
      raise exception 'The expiration date cannot be before the completion date.' using errcode = 'P0001';
    end if;
    new_exp := p_membership_expiry;
  else
    new_exp := case kind
      when 'years' then (p_completed_on + make_interval(years => (v->>'years')::int))::date
      when 'school-year' then make_date(extract(year from p_completed_on)::int + case when extract(month from p_completed_on) >= 7 then 1 else 0 end, 6, 30)
      else null end;
  end if;

  perform set_config('svla.admin_edit', 'on', true);
  update public.submissions
     set completed_on = p_completed_on,
         expires_on = new_exp,
         details = case when kind = 'membership'
                        then jsonb_set(details, '{membershipExpiry}', to_jsonb(p_membership_expiry::text))
                        else details end,
         edit_log = edit_log || jsonb_build_array(jsonb_build_object(
           'at', now(), 'by', v_email,
           'fromCompletedOn', s.completed_on, 'toCompletedOn', p_completed_on,
           'fromExpiresOn', s.expires_on, 'toExpiresOn', new_exp,
           'note', left(btrim(coalesce(p_note, '')), 500)))
   where id = p_id;
  perform set_config('svla.admin_edit', 'off', true);
end $$;

revoke all on function public.admin_edit_submission(uuid, date, date, text) from public, anon;
grant execute on function public.admin_edit_submission(uuid, date, date, text) to authenticated;
