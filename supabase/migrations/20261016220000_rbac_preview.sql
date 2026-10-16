-- =====================================================================
-- "Preview as" for board members: shows exactly what another person would see
-- under the role system. Read-only by construction: no session is ever created
-- as the other person, and every function below refuses non-board callers.
-- The existing access functions are refactored to delegate to email-parameterised
-- helpers so the preview and the real thing cannot drift apart.
-- =====================================================================

-- ---------- email-parameterised helpers (private) ----------
create or replace function private.can_view_as(p_email text, p_view text, p_team text default null, p_min text default 'view')
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.board_members b where b.email = lower(p_email)) or (
    private.level_rank(p_min) >= 1 and exists (
      select 1
      from public.staff_access sa
      join public.role_view_access rva on rva.role_key = sa.role_key and rva.view_key = p_view
      join public.app_views v on v.key = rva.view_key
      where sa.email = lower(p_email)
        and private.level_rank(rva.level) >= private.level_rank(p_min)
        and private.level_rank(v.max_level) >= private.level_rank(p_min)
        and ((p_team is null and cardinality(sa.teams) > 0) or p_team = any(sa.teams))
    )
  )
$$;

create or replace function private.can_view(p_view text, p_team text default null, p_min text default 'view')
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_view_as(private.confirmed_email(), p_view, p_team, p_min)
$$;

create or replace function private.access_for(p_email text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  sa public.staff_access;
  r public.app_roles;
begin
  if v_email = '' then
    return jsonb_build_object('isBoard', false, 'role', null, 'roleLabel', null, 'teams', '[]'::jsonb, 'views', '{}'::jsonb);
  end if;
  if exists (select 1 from public.board_members b where b.email = v_email) then
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

create or replace function private.staff_roster_for(p_email text)
returns table(coach_id uuid, name text, team text, role text, email text, phone text, pay text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.team, c.role,
         case when private.can_view_as(p_email, 'contact_info', c.team) then c.email end,
         case when private.can_view_as(p_email, 'contact_info', c.team) then c.phone end,
         case when private.can_view_as(p_email, 'pay_status', c.team) then c.pay end
  from public.coaches c
  where c.status = 'approved' and c.archived_at is null
    and private.can_view_as(p_email, 'staff_roster', c.team)
  order by c.team, c.role, c.name
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
     and (jsonb_array_length(coalesce(r.definition->'appliesToTeams', '[]'::jsonb)) = 0
          or (r.definition->'appliesToTeams') ? c.team)
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

-- ---------- the real functions now delegate to the helpers ----------
create or replace function public.my_access()
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.access_for(private.confirmed_email())
$$;

create or replace function public.staff_roster()
returns table(coach_id uuid, name text, team text, role text, email text, phone text, pay text)
language sql stable security definer set search_path = '' as $$
  select * from private.staff_roster_for(private.confirmed_email())
$$;

create or replace function public.staff_compliance_status()
returns table(coach_id uuid, coach_name text, team text, coach_role text,
              requirement_id text, requirement_name text, state text,
              expires_on date, days_to_expiry int, follow_up_on date)
language sql stable security definer set search_path = '' as $$
  select * from private.staff_status_for(private.confirmed_email())
$$;

-- ---------- board-only preview functions ----------
create or replace function public.preview_access(p_email text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_board() then raise exception 'Board access is required.' using errcode = 'P0001'; end if;
  return private.access_for(p_email);
end $$;

create or replace function public.preview_staff_roster(p_email text)
returns table(coach_id uuid, name text, team text, role text, email text, phone text, pay text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_board() then raise exception 'Board access is required.' using errcode = 'P0001'; end if;
  return query select * from private.staff_roster_for(p_email);
end $$;

create or replace function public.preview_staff_status(p_email text)
returns table(coach_id uuid, coach_name text, team text, coach_role text,
              requirement_id text, requirement_name text, state text,
              expires_on date, days_to_expiry int, follow_up_on date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_board() then raise exception 'Board access is required.' using errcode = 'P0001'; end if;
  return query select * from private.staff_status_for(p_email);
end $$;

-- one audit entry when a preview starts (the app calls this once, not on every refresh)
create or replace function public.admin_log_preview(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_board() then raise exception 'Board access is required.' using errcode = 'P0001'; end if;
  insert into public.access_audit (by_email, action, detail)
  values (private.confirmed_email(), 'preview_start', jsonb_build_object('email', lower(btrim(coalesce(p_email, '')))));
end $$;

-- lock down execute
revoke execute on function private.can_view_as(text,text,text,text), private.access_for(text),
  private.staff_roster_for(text), private.staff_status_for(text) from public, anon, authenticated;
revoke execute on function public.preview_access(text), public.preview_staff_roster(text),
  public.preview_staff_status(text), public.admin_log_preview(text) from public, anon;
grant execute on function public.preview_access(text), public.preview_staff_roster(text),
  public.preview_staff_status(text), public.admin_log_preview(text) to authenticated;
