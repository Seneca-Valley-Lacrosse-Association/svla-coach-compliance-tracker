-- Youth / High School programs.
-- Requirements roll up to two tracks via "level" (youth | high-school | both). Teams roll up to programs.
-- Coach detail keeps the full team split. Board and Youth/HS Volunteer are in both programs.

-- 1. Coaches: new volunteer teams and the "also coaches youth" flag for HS coaches.
alter table public.coaches add column if not exists also_coaches_youth boolean not null default false;

alter table public.coaches drop constraint if exists coaches_team_check;
update public.coaches set team = 'Youth/HS Volunteer' where team = 'Volunteer';
alter table public.coaches add constraint coaches_team_check
  check (team in ('8U','10U','12U','14U','HS-JV','HS-Varsity','Board','Youth Volunteer','HS Volunteer','Youth/HS Volunteer'));

-- 2. Staff access scoping uses the same team names. Old "Volunteer" scope becomes Youth/HS Volunteer.
alter table public.staff_access drop constraint if exists staff_access_teams_check;
update public.staff_access
  set teams = array_replace(teams, 'Volunteer', 'Youth/HS Volunteer')
  where 'Volunteer' = any(teams);
alter table public.staff_access add constraint staff_access_teams_check
  check (teams <@ array['8U','10U','12U','14U','HS-JV','HS-Varsity','Board','Youth Volunteer','HS Volunteer','Youth/HS Volunteer']::text[]);

-- 3. Requirements: every requirement gets an explicit level, and the per-team list is dropped.
--    Levels reproduce what each requirement did before (team lists included Board and the old Volunteer team).
update public.requirements r
set definition = (r.definition - 'appliesToTeams') || jsonb_build_object('level',
  case r.id
    when 'pa-state-police' then 'high-school'
    when 'fbi-fingerprint' then 'high-school'
    when 'concussion' then 'high-school'
    when 'sudden-cardiac' then 'high-school'
    when 'piaa-rules-meeting' then 'high-school'
    when 'usal-bronze' then 'youth'
    else coalesce(nullif(r.definition->>'level', ''), 'both')
  end);

-- 4. Shared SQL rules (mirror lib/compliance.ts coachPrograms / appliesToInProgram).
create or replace function private.coach_programs(p_team text, p_also_youth boolean)
returns text[] language sql immutable set search_path = '' as $$
  select array(
    select prog from unnest(array['youth','high-school']) prog
    where (prog = 'youth' and (p_team in ('8U','10U','12U','14U','Board','Youth Volunteer','Youth/HS Volunteer') or coalesce(p_also_youth, false)))
       or (prog = 'high-school' and p_team in ('HS-JV','HS-Varsity','Board','HS Volunteer','Youth/HS Volunteer'))
  )
$$;

create or replace function private.requirement_applies(p_def jsonb, p_team text, p_also_youth boolean)
returns boolean language sql immutable set search_path = '' as $$
  select case coalesce(p_def->>'level', 'both')
    when 'both' then cardinality(private.coach_programs(p_team, p_also_youth)) > 0
    else (p_def->>'level') = any(private.coach_programs(p_team, p_also_youth))
  end
$$;

-- 5. Staff status views now honor the program level (they used to ignore it).
create or replace function public.staff_compliance_status()
returns table(coach_id uuid, coach_name text, team text, coach_role text,
              requirement_id text, requirement_name text, state text,
              expires_on date, days_to_expiry int, follow_up_on date)
language sql stable security definer set search_path = '' as $$
  with applicable as (
    select c.id as cid, c.name as cname, c.team as cteam, c.role as crole,
           r.id as rid, r.definition->>'name' as rname, r.sort_order as rsort
    from public.coaches c
    join public.requirements r
      on coalesce((r.definition->>'active')::boolean, true)
     and (r.definition->'appliesToRoles') ? c.role
     and (r.definition->'appliesToPay') ? c.pay
     and private.requirement_applies(r.definition, c.team, c.also_coaches_youth)
    where c.status = 'approved' and c.archived_at is null
      and private.can_view('clearance_status', c.team)
  )
  select a.cid, a.cname, a.cteam, a.crole, a.rid, a.rname,
         case
           when s.id is null then case when p.coach_id is not null then 'in_progress' else 'missing' end
           when s.status = 'approved' and (s.expires_on is null or s.expires_on >= (now() at time zone 'America/New_York')::date) then 'complete'
           when s.status = 'approved' then 'expired'
           when s.status = 'pending' then 'pending_review'
           else 'rejected'
         end,
         s.expires_on,
         case when s.expires_on is null then null
              else (s.expires_on - (now() at time zone 'America/New_York')::date) end,
         p.follow_up_on
  from applicable a
  left join lateral (
    select x.* from public.submissions x
    where x.coach_id = a.cid and x.requirement_id = a.rid
    order by (x.status = 'approved' and (x.expires_on is null or x.expires_on >= (now() at time zone 'America/New_York')::date)) desc,
             x.created_at desc
    limit 1
  ) s on true
  left join public.progress p on p.coach_id = a.cid and p.requirement_id = a.rid
  order by a.cteam, a.cname, a.rsort
$$;

create or replace function private.staff_status_for(p_email text)
returns table(coach_id uuid, coach_name text, team text, coach_role text,
              requirement_id text, requirement_name text, state text,
              expires_on date, days_to_expiry int, follow_up_on date)
language sql stable security definer set search_path = '' as $$
  with applicable as (
    select c.id as cid, c.name as cname, c.team as cteam, c.role as crole,
           r.id as rid, r.definition->>'name' as rname, r.sort_order as rsort
    from public.coaches c
    join public.requirements r
      on coalesce((r.definition->>'active')::boolean, true)
     and (r.definition->'appliesToRoles') ? c.role
     and (r.definition->'appliesToPay') ? c.pay
     and private.requirement_applies(r.definition, c.team, c.also_coaches_youth)
    where c.status = 'approved' and c.archived_at is null
      and private.can_view_as(p_email, 'clearance_status', c.team)
  )
  select a.cid, a.cname, a.cteam, a.crole, a.rid, a.rname,
         case
           when s.id is null then case when p.coach_id is not null then 'in_progress' else 'missing' end
           when s.status = 'approved' and (s.expires_on is null or s.expires_on >= (now() at time zone 'America/New_York')::date) then 'complete'
           when s.status = 'approved' then 'expired'
           when s.status = 'pending' then 'pending_review'
           else 'rejected'
         end,
         s.expires_on,
         case when s.expires_on is null then null
              else (s.expires_on - (now() at time zone 'America/New_York')::date) end,
         p.follow_up_on
  from applicable a
  left join lateral (
    select x.* from public.submissions x
    where x.coach_id = a.cid and x.requirement_id = a.rid
    order by (x.status = 'approved' and (x.expires_on is null or x.expires_on >= (now() at time zone 'America/New_York')::date)) desc,
             x.created_at desc
    limit 1
  ) s on true
  left join public.progress p on p.coach_id = a.cid and p.requirement_id = a.rid
  order by a.cteam, a.cname, a.rsort
$$;

-- 6. Access screen and staff scoping know the new team names.
create or replace function public.admin_access_config()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_board() then raise exception 'Board access is required.' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'roles',  (select coalesce(jsonb_agg(jsonb_build_object('key', r.key, 'label', r.label, 'description', r.description) order by r.sort_order, r.key), '[]'::jsonb) from public.app_roles r),
    'views',  (select coalesce(jsonb_agg(jsonb_build_object('key', v.key, 'label', v.label, 'description', v.description, 'maxLevel', v.max_level) order by v.sort_order, v.key), '[]'::jsonb) from public.app_views v),
    'matrix', (select coalesce(jsonb_agg(jsonb_build_object('role', a.role_key, 'view', a.view_key, 'level', a.level)), '[]'::jsonb) from public.role_view_access a),
    'staff',  (select coalesce(jsonb_agg(jsonb_build_object(
                  'email', s.email, 'role', s.role_key, 'teams', to_jsonb(s.teams),
                  'name', c.name, 'coachTeam', c.team, 'lastSignInAt', u.last_sign_in_at) order by s.email), '[]'::jsonb)
               from public.staff_access s
               left join public.coaches c on lower(c.email) = s.email
               left join auth.users u on lower(u.email) = s.email),
    'teams',  to_jsonb(array['8U','10U','12U','14U','HS-JV','HS-Varsity','Board','Youth Volunteer','HS Volunteer','Youth/HS Volunteer']::text[])
  );
end $$;

create or replace function public.admin_set_staff_access(p_email text, p_role text, p_teams text[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_valid text[] := array['8U','10U','12U','14U','HS-JV','HS-Varsity','Board','Youth Volunteer','HS Volunteer','Youth/HS Volunteer'];
begin
  if not private.is_board() then raise exception 'Board access is required.' using errcode = 'P0001'; end if;
  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address.' using errcode = 'P0001'; end if;

  if p_role is null then
    delete from public.staff_access where email = v_email;
    insert into public.access_audit (by_email, action, detail)
    values (private.confirmed_email(), 'remove_staff_access', jsonb_build_object('email', v_email));
    return;
  end if;

  if exists (select 1 from public.board_members b where b.email = v_email) then
    raise exception 'Board members already have full access.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.app_roles where key = p_role) then raise exception 'Role not found.' using errcode = 'P0001'; end if;
  if p_teams is null or cardinality(p_teams) = 0 then raise exception 'Choose at least one team.' using errcode = 'P0001'; end if;
  if not (p_teams <@ v_valid) then raise exception 'Unknown team in selection.' using errcode = 'P0001'; end if;

  insert into public.staff_access as s (email, role_key, teams, created_by)
  values (v_email, p_role, p_teams, private.confirmed_email())
  on conflict (email) do update set role_key = excluded.role_key, teams = excluded.teams;

  insert into public.access_audit (by_email, action, detail)
  values (private.confirmed_email(), 'set_staff_access', jsonb_build_object('email', v_email, 'role', p_role, 'teams', to_jsonb(p_teams)));
end $$;
