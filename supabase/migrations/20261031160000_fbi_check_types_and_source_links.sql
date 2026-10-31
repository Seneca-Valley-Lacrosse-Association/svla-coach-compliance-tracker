-- FBI fingerprint check by document type, and multiple source links per requirement.
--
-- 1. Each FBI upload now records which check it is (details.fbiCheck):
--      dhs-volunteer   PA DHS volunteer, code 1KG6ZJ
--      dhs-employee    PA DHS employee, code 1KG756
--      school-employee Seneca Valley school employee, code 1KG6XN
--      affidavit       PA DHS Volunteer Disclosure Statement
--    Pay status is SVLA-wide. Which check counts where is decided in the app (lib/compliance.ts):
--      youth volunteer:  1KG6ZJ, 1KG756, or the affidavit if a 10-year PA resident
--      youth paid:       1KG756
--      high school:      1KG6XN for every coach, paid or volunteer (Seneca Valley athletic director, Oct 13 2026)
--    PA DHS does not accept an FBI check run for another department, so a coach in both programs uploads two
--    (a 10-year PA resident volunteer can cover youth with the disclosure statement instead).
--    The upload trigger validates the value and keeps the older fbiMethod field in step, and the affidavit is now
--    refused unless the coach is a youth volunteer who has lived in PA for 10 years (high school does not accept it).
-- 2. The public badge page receives fbiCheck so it judges the FBI item the same way.
-- 3. The FBI requirement gets the new instructions, reason and source links. `sources` is a list of
--    {label, url} that the board edits with the + button; the old single `sourceUrl` is cleared for this one.
-- No FBI uploads existed when this was written, so no submission data needs converting.

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
  if (req->>'allowsVolunteerAffidavit')::boolean is true then
    -- Which FBI document this is. Older clients send only fbiMethod; keep fbiMethod in step with fbiCheck.
    if new.details ? 'fbiCheck' then
      if new.details->>'fbiCheck' not in ('dhs-volunteer', 'dhs-employee', 'school-employee', 'affidavit') then
        raise exception 'Choose which FBI check you are uploading.';
      end if;
      new.details := new.details || jsonb_build_object('fbiMethod',
        case when new.details->>'fbiCheck' = 'affidavit' then 'affidavit' else 'fingerprint' end);
    end if;
    if new.details->>'fbiMethod' = 'affidavit'
       and not (c.pay = 'Volunteer' and c.pa_resident_10_years
                and 'youth' = any(private.coach_programs(c.team, c.also_coaches_youth))) then
      raise exception 'The volunteer disclosure statement is only for youth volunteers who have lived in Pennsylvania for 10 years.';
    end if;
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

create or replace function public.verify_badge(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c public.coaches;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 128 then return null; end if;
  select * into c from public.coaches x
    where x.verify_token = p_token and x.status = 'approved' and x.archived_at is null;
  if not found then return null; end if;
  return jsonb_build_object(
    'coach', jsonb_build_object('name', c.name, 'team', c.team, 'role', c.role, 'pay', c.pay,
      'paResident10Years', c.pa_resident_10_years, 'alsoCoachesYouth', c.also_coaches_youth),
    'requirements', (select coalesce(jsonb_agg(r.definition || jsonb_build_object('id', r.id, 'order', r.sort_order) order by r.sort_order), '[]'::jsonb)
                     from public.requirements r),
    'submissions', (select coalesce(jsonb_agg(jsonb_build_object(
        'requirementId', s.requirement_id, 'status', s.status,
        'uploadedOn', s.uploaded_at, 'completedOn', s.completed_on, 'expiresOn', s.expires_on,
        'obtainedAs', s.details->>'obtainedAs', 'fbiMethod', s.details->>'fbiMethod', 'fbiCheck', s.details->>'fbiCheck',
        'membershipNumber', s.details->>'membershipNumber')), '[]'::jsonb)
                    from public.submissions s where s.coach_id = c.id)
  );
end $$;
revoke all on function public.verify_badge(text) from public;
grant execute on function public.verify_badge(text) to anon, authenticated;

update public.requirements
   set definition = definition || $json${
  "help": "Register at uenroll.identogo.com, then get fingerprinted at a local IdentoGO site. Use the service code that matches your role.\n\nHIGH SCHOOL COACHES (paid or volunteer)\nCode 1KG6XN: Seneca Valley school employee.\nFollow the Seneca Valley employee clearance directions (linked under \"Why we require this\") and submit all three clearances to Seneca Valley HR together.\n\nYOUTH VOLUNTEERS\nCode 1KG6ZJ: PA DHS volunteer.\n\nPAID YOUTH COACHES\nCode 1KG756: PA DHS employee.\n\nCOACHES IN BOTH PROGRAMS\nYou need the high school check (1KG6XN) and a youth check (1KG6ZJ for volunteers, 1KG756 for paid coaches). Upload each one separately. A school check does not count for youth, and a youth check does not count for high school.\n\nNO FINGERPRINTS FOR YOUTH (youth volunteers only)\nIf you have lived in Pennsylvania for the past 10 years, you may sign the Volunteer Disclosure Statement for youth instead of the 1KG6ZJ check. It does not count for high school.\n\nWhen you upload, choose which check you are uploading.",
  "why": "The FBI check covers criminal records from outside Pennsylvania, which the state police check does not.\n\nPA DHS does not accept an FBI check run for another department, so the youth (DHS) and high school (school district) checks are not interchangeable. Coaches in both programs need one of each.",
  "source": "Youth: PA Child Protective Services Law (23 Pa.C.S. §§ 6344, 6344.2).\nHigh school: PA School Code, Section 111 (Act 114), and Seneca Valley School District Policy 916.",
  "sourceUrl": "",
  "sources": [
    {
      "label": "PA DHS: FBI fingerprinting and service codes",
      "url": "https://www.pa.gov/agencies/dhs/resources/keep-kids-safe/child-abuse-clearances/fbi-fingerprinting"
    },
    {
      "label": "PA DHS: Volunteer Disclosure Statement (form)",
      "url": "https://www.dhs.pa.gov/KeepKidsSafe/Resources/Documents/Disclosure%20Statement%20for%20Volunteers.pdf"
    },
    {
      "label": "Seneca Valley: Employee clearance directions (all high school coaches)",
      "url": "https://resources.finalsite.net/images/v1726576746/svsdnet/cl1fenbixiwe8zigwcyc/EmployeeClearanceApplicationRenewal2024.pdf"
    }
  ]
}$json$::jsonb
 where id = 'fbi-fingerprint';
