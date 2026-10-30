-- Board and Volunteer teams are named by program: Board-Youth, Board-HS, Board-Youth/HS and
-- Volunteer-Youth, Volunteer-HS, Volunteer-Youth/HS. Existing Board and Youth/HS Volunteer
-- records keep both programs, so nobody's requirements change.

alter table public.coaches drop constraint if exists coaches_team_check;
update public.coaches set team = case team
  when 'Board' then 'Board-Youth/HS'
  when 'Youth Volunteer' then 'Volunteer-Youth'
  when 'HS Volunteer' then 'Volunteer-HS'
  when 'Youth/HS Volunteer' then 'Volunteer-Youth/HS'
  else team end
where team in ('Board','Youth Volunteer','HS Volunteer','Youth/HS Volunteer');
alter table public.coaches add constraint coaches_team_check check (team in ('8U','10U','12U','14U','HS-JV','HS-Varsity','Board-Youth','Board-HS','Board-Youth/HS','Volunteer-Youth','Volunteer-HS','Volunteer-Youth/HS'));

alter table public.staff_access drop constraint if exists staff_access_teams_check;
update public.staff_access s set teams = (
  select array_agg(distinct case t
    when 'Board' then 'Board-Youth/HS'
    when 'Youth Volunteer' then 'Volunteer-Youth'
    when 'HS Volunteer' then 'Volunteer-HS'
    when 'Youth/HS Volunteer' then 'Volunteer-Youth/HS'
    else t end) from unnest(s.teams) t)
where s.teams && array['Board','Youth Volunteer','HS Volunteer','Youth/HS Volunteer'];
alter table public.staff_access add constraint staff_access_teams_check check (teams <@ array['8U','10U','12U','14U','HS-JV','HS-Varsity','Board-Youth','Board-HS','Board-Youth/HS','Volunteer-Youth','Volunteer-HS','Volunteer-Youth/HS']::text[]);

create or replace function private.coach_programs(p_team text, p_also_youth boolean)
returns text[] language sql immutable set search_path = '' as $$
  select array(
    select prog from unnest(array['youth','high-school']) prog
    where (prog = 'youth' and (p_team in ('8U','10U','12U','14U','Board-Youth','Board-Youth/HS','Volunteer-Youth','Volunteer-Youth/HS') or coalesce(p_also_youth, false)))
       or (prog = 'high-school' and p_team in ('HS-JV','HS-Varsity','Board-HS','Board-Youth/HS','Volunteer-HS','Volunteer-Youth/HS'))
  )
$$;

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
    'teams',  to_jsonb(array['8U','10U','12U','14U','HS-JV','HS-Varsity','Board-Youth','Board-HS','Board-Youth/HS','Volunteer-Youth','Volunteer-HS','Volunteer-Youth/HS']::text[])
  );
end $$;

create or replace function public.admin_set_staff_access(p_email text, p_role text, p_teams text[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_valid text[] := array['8U','10U','12U','14U','HS-JV','HS-Varsity','Board-Youth','Board-HS','Board-Youth/HS','Volunteer-Youth','Volunteer-HS','Volunteer-Youth/HS'];
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
