-- Per-requirement "needs board review" setting.
-- Stored in requirements.definition as {"requiresReview": true|false}. A missing value means true, so every
-- existing requirement keeps going to the board review queue exactly as before.
-- When a requirement is set to false, a new submission is approved automatically by this trigger (not by the
-- browser), so it cannot be bypassed or forged by a client. Only the review step is skipped: every validation
-- rule (dates, document, membership, signature, eligibility) still runs first. Auto-approved rows have
-- reviewed_by = null and a review_comment that says so. Existing pending submissions are not changed.

create or replace function public.submissions_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  req jsonb; c public.coaches; v jsonb; kind text; mexp date;
begin
  select definition into req from public.requirements where id = new.requirement_id;
  if req is null then raise exception 'Requirement not found.'; end if;
  select * into c from public.coaches where id = new.coach_id;
  if c.id is null then raise exception 'Coach not found.'; end if;
  if coalesce((req->>'active')::boolean, true) is not true then raise exception 'This requirement is not active.'; end if;
  if not ((req->'appliesToRoles') ? c.role and (req->'appliesToPay') ? c.pay) then
    raise exception 'This requirement does not apply to this coach.';
  end if;
  if new.completed_on > ((now() at time zone 'utc')::date + 1) then
    raise exception 'The completion date cannot be in the future.';
  end if;

  new.status := 'pending'; new.reviewed_on := null; new.reviewed_by := null; new.review_comment := null;
  new.uploaded_at := (now() at time zone 'America/New_York')::date;
  new.submitted_by := (select auth.uid());

  if new.file_path is not null and split_part(new.file_path, '/', 1) <> new.coach_id::text then
    raise exception 'Invalid document path.';
  end if;
  if (req->>'type') in ('File','Training') and coalesce((req->>'dateOnlyAllowed')::boolean, false) is not true
     and new.file_path is null then
    raise exception 'A document upload is required for this requirement.';
  end if;
  if (req->>'type') = 'Membership' then
    begin mexp := (new.details->>'membershipExpiry')::date; exception when others then mexp := null; end;
    if mexp is null or coalesce(new.details->>'membershipNumber','') = '' then
      raise exception 'Enter your membership number and expiration date.';
    end if;
    if mexp <= (now() at time zone 'utc')::date then raise exception 'That membership has already expired.'; end if;
  end if;
  if (req->>'type') = 'Signature' then
    if lower(btrim(coalesce(new.details->>'signedName',''))) <> lower(c.name)
       or coalesce((new.details->>'agreed')::boolean, false) is not true then
      raise exception 'Type your full name exactly as listed and check the agreement box.';
    end if;
  end if;
  if (req->>'allowsVolunteerAffidavit')::boolean is true and new.details->>'fbiMethod' = 'affidavit'
     and not (c.pay = 'Volunteer' and c.pa_resident_10_years) then
    raise exception 'The volunteer disclosure option is only for volunteers who have lived in Pennsylvania for 10 years.';
  end if;

  v := req->'validity'; kind := v->>'kind';
  new.expires_on := case kind
    when 'years' then (new.completed_on + make_interval(years => (v->>'years')::int))::date
    when 'school-year' then make_date(extract(year from new.completed_on)::int + case when extract(month from new.completed_on) >= 7 then 1 else 0 end, 6, 30)
    when 'membership' then mexp
    else null end;

  -- Skip the board review queue only when the board explicitly turned review off for this requirement.
  if coalesce((req->>'requiresReview')::boolean, true) is false then
    new.status := 'approved';
    new.reviewed_on := (now() at time zone 'America/New_York')::date;
    new.review_comment := 'Auto-approved. This requirement does not need board review.';
  end if;
  return new;
end $$;

revoke all on function public.submissions_before_insert() from public, anon, authenticated;
