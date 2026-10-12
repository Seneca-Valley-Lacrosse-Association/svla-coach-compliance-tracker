-- SVLA Coach Compliance Tracker: initial schema, security rules, and default requirements.
-- Access model: every table has Row Level Security. Board members (public.board_members) see and
-- manage everything. A signed-in coach sees only their own roster row and submissions, matched by a
-- CONFIRMED email address. Anonymous visitors have no access.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables
create table public.board_members (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create table public.coaches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (email = lower(email) and char_length(email) <= 254),
  phone text not null default '' check (char_length(phone) <= 40),
  team text not null check (team in ('8U','10U','12U','14U','HS-JV','HS-Varsity')),
  role text not null check (role in ('Head Coach','Coordinator','Assistant Coach','Volunteer Assistant')),
  pay text not null check (pay in ('Paid','Volunteer')),
  pa_resident_10_years boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index coaches_email_key on public.coaches (lower(email));

create sequence public.requirements_sort_order_seq;
create table public.requirements (
  id text primary key default gen_random_uuid()::text,
  sort_order integer not null default nextval('public.requirements_sort_order_seq'),
  definition jsonb not null,
  created_at timestamptz not null default now()
);
alter sequence public.requirements_sort_order_seq owned by public.requirements.sort_order;

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  requirement_id text not null references public.requirements(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  uploaded_at date not null default ((now() at time zone 'America/New_York')::date),
  completed_on date not null,
  expires_on date,
  file_path text check (char_length(file_path) <= 400),
  file_name text check (char_length(file_name) <= 255),
  details jsonb not null default '{}'::jsonb,
  review_comment text check (char_length(review_comment) <= 2000),
  reviewed_on date,
  submitted_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index submissions_coach_idx on public.submissions (coach_id);
create index submissions_requirement_idx on public.submissions (requirement_id);
create index submissions_status_idx on public.submissions (status);

-- ---------------------------------------------------------------- identity helpers
-- Email of the signed-in user, only if Supabase Auth has confirmed it (blocks sign-ups that claim
-- someone else's address without owning it).
create or replace function public.confirmed_email()
returns text language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null
$$;

create or replace function public.is_board()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.board_members b where b.email = public.confirmed_email())
$$;

create or replace function public.is_coach(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coaches c where c.id = target and lower(c.email) = public.confirmed_email())
$$;

revoke all on function public.confirmed_email(), public.is_board(), public.is_coach(uuid) from public, anon;
grant execute on function public.confirmed_email(), public.is_board(), public.is_coach(uuid) to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.board_members enable row level security;
alter table public.coaches enable row level security;
alter table public.requirements enable row level security;
alter table public.submissions enable row level security;

revoke all on public.board_members, public.coaches, public.requirements, public.submissions from anon;
revoke all on public.board_members from authenticated;
grant select on public.board_members to authenticated;
grant select, insert, update, delete on public.coaches, public.requirements to authenticated;
grant select, insert, update on public.submissions to authenticated;

create policy board_members_self_read on public.board_members for select to authenticated
  using (email = (select public.confirmed_email()));

create policy coaches_read on public.coaches for select to authenticated
  using ((select public.is_board()) or lower(email) = (select public.confirmed_email()));
create policy coaches_board_insert on public.coaches for insert to authenticated
  with check ((select public.is_board()));
create policy coaches_board_update on public.coaches for update to authenticated
  using ((select public.is_board())) with check ((select public.is_board()));
create policy coaches_board_delete on public.coaches for delete to authenticated
  using ((select public.is_board()));

create policy requirements_read on public.requirements for select to authenticated
  using ((select public.confirmed_email()) is not null);
create policy requirements_board_insert on public.requirements for insert to authenticated
  with check ((select public.is_board()));
create policy requirements_board_update on public.requirements for update to authenticated
  using ((select public.is_board())) with check ((select public.is_board()));

create policy submissions_read on public.submissions for select to authenticated
  using ((select public.is_board()) or (select public.is_coach(coach_id)));
create policy submissions_insert on public.submissions for insert to authenticated
  with check (submitted_by = (select auth.uid()) and ((select public.is_board()) or (select public.is_coach(coach_id))));
create policy submissions_board_review on public.submissions for update to authenticated
  using ((select public.is_board())) with check ((select public.is_board()));

-- ---------------------------------------------------------------- business rules (errors surface as P0001)
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
  return new;
end $$;

create or replace function public.submissions_before_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
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

revoke all on function public.submissions_before_insert(), public.submissions_before_update() from public, anon, authenticated;
create trigger submissions_before_insert before insert on public.submissions
  for each row execute function public.submissions_before_insert();
create trigger submissions_before_update before update on public.submissions
  for each row execute function public.submissions_before_update();

-- ---------------------------------------------------------------- document storage (private bucket)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificates', 'certificates', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy certificates_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'certificates' and (
    (select public.is_board()) or (select public.is_coach(((storage.foldername(name))[1])::uuid))));
create policy certificates_read on storage.objects for select to authenticated
  using (bucket_id = 'certificates' and (
    (select public.is_board()) or (select public.is_coach(((storage.foldername(name))[1])::uuid))));
create policy certificates_delete_own_upload on storage.objects for delete to authenticated
  using (bucket_id = 'certificates' and owner_id = (select auth.uid())::text);

-- ---------------------------------------------------------------- seed data
insert into public.requirements (id, sort_order, definition) values
  ('pa-child-abuse', 1, '{"name":"PA Child Abuse History Clearance","type":"File","appliesToRoles":["Head Coach","Coordinator","Assistant Coach","Volunteer Assistant"],"appliesToPay":["Paid","Volunteer"],"validity":{"kind":"years","years":5},"required":true,"active":true,"tracksObtainedAs":true,"help":"Apply online through the PA Department of Human Services. It is free for volunteers. Results usually arrive by email within 14 days. Upload the PDF certificate.","helpUrl":"https://www.compass.state.pa.us/cwis/public/home","helpLinkLabel":"PA Child Welfare Portal"}'::jsonb),
  ('pa-state-police', 2, '{"name":"PA State Police Criminal Record Check","type":"File","appliesToRoles":["Head Coach","Coordinator","Assistant Coach","Volunteer Assistant"],"appliesToPay":["Paid","Volunteer"],"validity":{"kind":"years","years":5},"required":true,"active":true,"tracksObtainedAs":true,"help":"Request a check online through PATCH. Results are often instant. Save the certificate as a PDF and upload it here.","helpUrl":"https://epatch.pa.gov/","helpLinkLabel":"PA State Police PATCH"}'::jsonb),
  ('fbi-fingerprint', 3, '{"name":"FBI Fingerprint Check","type":"File","appliesToRoles":["Head Coach","Coordinator","Assistant Coach","Volunteer Assistant"],"appliesToPay":["Paid","Volunteer"],"validity":{"kind":"years","years":5},"required":true,"active":true,"tracksObtainedAs":true,"allowsVolunteerAffidavit":true,"help":"Register with IdentoGO and get fingerprinted at a local site. Volunteers who have lived in PA for the past 10 years may sign a Volunteer Disclosure Statement instead. Paid coaches must get fingerprinted.","helpUrl":"https://uenroll.identogo.com/","helpLinkLabel":"IdentoGO fingerprinting"}'::jsonb),
  ('usal-membership', 4, '{"name":"USA Lacrosse Coach-Level Membership","type":"Membership","appliesToRoles":["Head Coach","Coordinator","Assistant Coach","Volunteer Assistant"],"appliesToPay":["Paid","Volunteer"],"validity":{"kind":"membership"},"required":true,"active":true,"help":"Join or renew at the Coach level on the USA Lacrosse website. Enter your membership number and expiration date exactly as shown on your membership card.","helpUrl":"https://www.usalacrosse.com/membership","helpLinkLabel":"USA Lacrosse membership"}'::jsonb),
  ('usal-bronze', 5, '{"name":"USA Lacrosse Background Screen & Bronze Certification","type":"File","appliesToRoles":["Head Coach","Coordinator","Assistant Coach","Volunteer Assistant"],"appliesToPay":["Paid","Volunteer"],"validity":{"kind":"years","years":2},"required":true,"active":true,"dateOnlyAllowed":true,"help":"Log in to your USA Lacrosse account to complete the background screen and the free Bronze level online course. Upload the certificate or enter the completion date.","helpUrl":"https://www.usalacrosse.com/coaches","helpLinkLabel":"USA Lacrosse coaching"}'::jsonb),
  ('concussion', 6, '{"name":"Annual Concussion Training","type":"Training","appliesToRoles":["Head Coach","Coordinator","Assistant Coach","Volunteer Assistant"],"appliesToPay":["Paid","Volunteer"],"validity":{"kind":"school-year"},"required":true,"active":true,"help":"Take the free CDC HEADS UP online course (about 30 minutes). It must be retaken every school year. Upload the completion certificate.","helpUrl":"https://www.cdc.gov/heads-up/","helpLinkLabel":"CDC HEADS UP training"}'::jsonb),
  ('sudden-cardiac', 7, '{"name":"Annual Sudden Cardiac Arrest Training","type":"Training","appliesToRoles":["Head Coach","Coordinator","Assistant Coach","Volunteer Assistant"],"appliesToPay":["Paid","Volunteer"],"validity":{"kind":"school-year"},"required":true,"active":true,"help":"Complete a free sudden cardiac arrest awareness course online. It must be retaken every school year. Upload the completion certificate.","helpUrl":"https://www.nfhslearn.com/courses/sudden-cardiac-arrest","helpLinkLabel":"NFHS Learn course"}'::jsonb),
  ('handbook', 8, '{"name":"Coach Handbook Acknowledgment","type":"Signature","appliesToRoles":["Head Coach","Coordinator","Assistant Coach","Volunteer Assistant"],"appliesToPay":["Paid","Volunteer"],"validity":{"kind":"one-time"},"required":true,"active":true,"help":"Read the SVLA Coach Handbook, then type your full name to sign that you have read and agree to follow it.","helpUrl":"","helpLinkLabel":""}'::jsonb),
  ('contract', 9, '{"name":"Signed Coaching Contract","type":"File","appliesToRoles":["Head Coach","Coordinator","Assistant Coach","Volunteer Assistant"],"appliesToPay":["Paid"],"validity":{"kind":"years","years":1},"required":true,"active":true,"help":"The board treasurer emails your contract each season. Sign it and upload the signed copy here.","helpUrl":"","helpLinkLabel":""}'::jsonb),
  ('cpr-first-aid', 10, '{"name":"CPR / First Aid Certification","type":"Training","appliesToRoles":["Head Coach"],"appliesToPay":["Paid","Volunteer"],"validity":{"kind":"years","years":2},"required":false,"active":false,"help":"Optional. Take an in-person or blended CPR and First Aid course from a recognized provider.","helpUrl":"https://www.redcross.org/take-a-class","helpLinkLabel":"Red Cross classes"}'::jsonb)
;
select setval('public.requirements_sort_order_seq', 100);

-- First board member. Add others with: insert into public.board_members (email) values ('name@example.org');
insert into public.board_members (email) values ('it@svlacrosse.org');
