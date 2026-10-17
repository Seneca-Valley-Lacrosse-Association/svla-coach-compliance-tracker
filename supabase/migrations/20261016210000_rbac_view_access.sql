-- =====================================================================
-- RBAC tier beneath Board. Additive only: board_members / is_board()
-- and every existing policy and function are untouched.
-- Limited roles read ONLY through SECURITY DEFINER functions below;
-- they are granted no direct table or storage access.
-- (Already applied to production on 2026-10-16 as "rbac_view_access_tier".)
-- =====================================================================

create table public.app_roles (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label text not null check (char_length(label) between 1 and 60),
  description text not null default '',
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

create table public.app_views (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label text not null,
  description text not null default '',
  -- highest level that can be delegated today; 'none' = board-only until a safe RPC exists
  max_level text not null default 'none' check (max_level in ('none','view','manage')),
  sort_order int not null default 100
);

create table public.role_view_access (
  role_key text not null references public.app_roles(key) on update cascade on delete cascade,
  view_key text not null references public.app_views(key) on update cascade on delete cascade,
  level text not null default 'none' check (level in ('none','view','manage')),
  updated_at timestamptz not null default now(),
  primary key (role_key, view_key)
);

create table public.staff_access (
  email text primary key check (email = lower(email) and char_length(email) <= 254),
  role_key text not null references public.app_roles(key) on update cascade,
  teams text[] not null default '{}'
    check (teams <@ array['8U','10U','12U','14U','HS-JV','HS-Varsity','Board','Volunteer']::text[]),
  created_at timestamptz not null default now(),
  created_by text
);

create table public.access_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  by_email text,
  action text not null,
  detail jsonb not null default '{}'::jsonb
);

alter table public.app_roles enable row level security;
alter table public.app_views enable row level security;
alter table public.role_view_access enable row level security;
alter table public.staff_access enable row level security;
alter table public.access_audit enable row level security;

create policy app_roles_board_read on public.app_roles for select to authenticated using ((select private.is_board()));
create policy app_views_board_read on public.app_views for select to authenticated using ((select private.is_board()));
create policy role_view_access_board_read on public.role_view_access for select to authenticated using ((select private.is_board()));
create policy staff_access_board_read on public.staff_access for select to authenticated using ((select private.is_board()));
create policy access_audit_board_read on public.access_audit for select to authenticated using ((select private.is_board()));

-- writes happen only through the board-gated RPCs below
revoke all on public.app_roles, public.app_views, public.role_view_access, public.staff_access, public.access_audit from anon, authenticated;
grant select on public.app_roles, public.app_views, public.role_view_access, public.staff_access, public.access_audit to authenticated;

-- ---------- seed ----------
insert into public.app_roles (key, label, description, sort_order) values
  ('program_lead', 'Program Lead', 'Head coach of a program (for example HS Varsity or JV). Sees only the teams assigned to them.', 10),
  ('coordinator',  'Age-Group Coordinator', 'Oversees one or more age groups. Sees only the teams assigned to them.', 20);

insert into public.app_views (key, label, description, max_level, sort_order) values
  ('staff_roster',          'Staff roster',          'Names, teams and roles of approved coaches', 'view', 10),
  ('clearance_status',      'Clearance status',      'Complete / pending / expired status and expiration dates. No documents.', 'view', 20),
  ('contact_info',          'Contact info',          'Coach email and phone', 'view', 30),
  ('pay_status',            'Pay status',            'Paid vs. volunteer', 'view', 40),
  ('documents',             'Documents & certificates', 'Uploaded clearance files and certificate details. Board only for now.', 'none', 50),
  ('review_queue',          'Review queue',          'Approve or reject submissions. Board only for now.', 'none', 60),
  ('accounts',              'Accounts & logins',     'Pending accounts, invites, login activity. Board only for now.', 'none', 70),
  ('tickets',               'Help tickets',          'Support tickets from coaches. Board only for now.', 'none', 80),
  ('requirements_settings', 'Requirements settings', 'Edit the requirement definitions. Board only for now.', 'none', 90);

insert into public.role_view_access (role_key, view_key, level)
select r.key, v.key,
       case when v.key in ('staff_roster','clearance_status') then 'view' else 'none' end
from public.app_roles r cross join public.app_views v;

-- ---------- helpers (private schema) ----------
create or replace function private.level_rank(p_level text)
returns int language sql immutable set search_path = '' as $$
  select case p_level when 'manage' then 2 when 'view' then 1 else 0 end
$$;

create or replace function private.can_view(p_view text, p_team text default null, p_min text default 'view')
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_board() or (
    private.level_rank(p_min) >= 1 and exists (
      select 1
      from public.staff_access sa
      join public.role_view_access rva on rva.role_key = sa.role_key and rva.view_key = p_view
      join public.app_views v on v.key = rva.view_key
      where sa.email = private.confirmed_email()
        and private.level_rank(rva.level) >= private.level_rank(p_min)
        and private.level_rank(v.max_level) >= private.level_rank(p_min)
        and ((p_team is null and cardinality(sa.teams) > 0) or p_team = any(sa.teams))
    )
  )
$$;

-- ---------- read RPCs for limited roles ----------
create or replace function public.my_access()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_email text := private.confirmed_email();
  sa public.staff_access;
  r public.app_roles;
begin
  if v_email is null then
    return jsonb_build_object('isBoard', false, 'role', null, 'roleLabel', null, 'teams', '[]'::jsonb, 'views', '{}'::jsonb);
  end if;
  if private.is_board() then
    return jsonb_build_object('isBoard', true, 'role', 'board', 'roleLabel', 'Board', 'teams', null,
      'views', (select coalesce(jsonb_object_agg(v.key, 'manage'), '{}'::jsonb) from public.app_views v));
  end if;
  select * into sa from public.staff_access x where x.email = v_email;
  if sa.email is null then
    return jsonb_build_object('isBoard', false, 'role', null, 'roleLabel', null, 'teams', '[]'::jsonb, 'views', '{}'::jsonb);
  end if;
  select * into r from public.app_roles y where y.key = sa.role_key;
  return jsonb_build_object(
    'isBoard', false, 'role', sa.role_key, 'roleLabel', r.label, 'teams', to_jsonb(sa.teams),
    'views', (select coalesce(jsonb_object_agg(rva.view_key,
                case when private.level_rank(rva.level) <= private.level_rank(v.max_level) then rva.level else v.max_level end), '{}'::jsonb)
              from public.role_view_access rva
              join public.app_views v on v.key = rva.view_key
              where rva.role_key = sa.role_key
                and least(private.level_rank(rva.level), private.level_rank(v.max_level)) >= 1));
end $$;

create or replace function public.staff_roster()
returns table(coach_id uuid, name text, team text, role text, email text, phone text, pay text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.team, c.role,
         case when private.can_view('contact_info', c.team) then c.email end,
         case when private.can_view('contact_info', c.team) then c.phone end,
         case when private.can_view('pay_status', c.team) then c.pay end
  from public.coaches c
  where c.status = 'approved' and c.archived_at is null
    and private.can_view('staff_roster', c.team)
  order by c.team, c.role, c.name
$$;

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
     and (jsonb_array_length(coalesce(r.definition->'appliesToTeams', '[]'::jsonb)) = 0
          or (r.definition->'appliesToTeams') ? c.team)
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

-- ---------- board-only admin RPCs ----------
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
    'teams',  to_jsonb(array['8U','10U','12U','14U','HS-JV','HS-Varsity','Board','Volunteer']::text[])
  );
end $$;

create or replace function public.admin_set_view_access(p_role text, p_view text, p_level text)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.app_views;
begin
  if not private.is_board() then raise exception 'Board access is required.' using errcode = 'P0001'; end if;
  if p_level not in ('none','view','manage') then raise exception 'Invalid access level.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.app_roles where key = p_role) then raise exception 'Role not found.' using errcode = 'P0001'; end if;
  select * into v from public.app_views where key = p_view;
  if v.key is null then raise exception 'View not found.' using errcode = 'P0001'; end if;
  if private.level_rank(p_level) > private.level_rank(v.max_level) then
    raise exception 'This view cannot be delegated yet. It remains board-only.' using errcode = 'P0001';
  end if;
  insert into public.role_view_access as a (role_key, view_key, level) values (p_role, p_view, p_level)
  on conflict (role_key, view_key) do update set level = excluded.level, updated_at = now();
  insert into public.access_audit (by_email, action, detail)
  values (private.confirmed_email(), 'set_view_access', jsonb_build_object('role', p_role, 'view', p_view, 'level', p_level));
end $$;

create or replace function public.admin_set_staff_access(p_email text, p_role text, p_teams text[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_valid text[] := array['8U','10U','12U','14U','HS-JV','HS-Varsity','Board','Volunteer'];
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

-- lock down execute: signed-in users only (each function self-checks)
revoke execute on function public.my_access(), public.staff_roster(), public.staff_compliance_status(),
  public.admin_access_config(), public.admin_set_view_access(text,text,text), public.admin_set_staff_access(text,text,text[])
  from public, anon;
grant execute on function public.my_access(), public.staff_roster(), public.staff_compliance_status(),
  public.admin_access_config(), public.admin_set_view_access(text,text,text), public.admin_set_staff_access(text,text,text[])
  to authenticated;
revoke execute on function private.can_view(text,text,text), private.level_rank(text) from public, anon;
grant execute on function private.can_view(text,text,text), private.level_rank(text) to authenticated;
