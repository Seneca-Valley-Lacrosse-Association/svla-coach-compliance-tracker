-- Team Compliance by program.
-- The staff status functions now also return each requirement's level (youth | high-school | both)
-- and the coach's assigned programs, so the head-coach Team Compliance page can show
-- "Cleared: Youth" and "Cleared: High School" separately, matching the board dashboard.
-- Only two columns are added at the end; existing callers keep working. Grants are restored exactly.

drop function if exists public.preview_staff_status(text);
drop function if exists private.staff_status_for(text);
drop function if exists public.staff_compliance_status();

create function public.staff_compliance_status()
returns table(coach_id uuid, coach_name text, team text, coach_role text,
              requirement_id text, requirement_name text, state text,
              expires_on date, days_to_expiry int, follow_up_on date,
              requirement_level text, coach_programs text[])
language sql stable security definer set search_path = '' as $$
  with applicable as (
    select c.id as cid, c.name as cname, c.team as cteam, c.role as crole,
           r.id as rid, r.definition->>'name' as rname, r.sort_order as rsort,
           coalesce(nullif(r.definition->>'level', ''), 'both') as rlevel,
           private.coach_programs(c.team, c.also_coaches_youth) as cprograms
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
         p.follow_up_on,
         a.rlevel,
         a.cprograms
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

create function private.staff_status_for(p_email text)
returns table(coach_id uuid, coach_name text, team text, coach_role text,
              requirement_id text, requirement_name text, state text,
              expires_on date, days_to_expiry int, follow_up_on date,
              requirement_level text, coach_programs text[])
language sql stable security definer set search_path = '' as $$
  with applicable as (
    select c.id as cid, c.name as cname, c.team as cteam, c.role as crole,
           r.id as rid, r.definition->>'name' as rname, r.sort_order as rsort,
           coalesce(nullif(r.definition->>'level', ''), 'both') as rlevel,
           private.coach_programs(c.team, c.also_coaches_youth) as cprograms
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
         p.follow_up_on,
         a.rlevel,
         a.cprograms
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

create function public.preview_staff_status(p_email text)
returns table(coach_id uuid, coach_name text, team text, coach_role text,
              requirement_id text, requirement_name text, state text,
              expires_on date, days_to_expiry int, follow_up_on date,
              requirement_level text, coach_programs text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_board() then raise exception 'Board access is required.' using errcode = 'P0001'; end if;
  return query select * from private.staff_status_for(p_email);
end $$;

-- Restore the previous permissions exactly.
revoke all on function public.staff_compliance_status() from public, anon, authenticated, service_role;
revoke all on function private.staff_status_for(text) from public, anon, authenticated, service_role;
revoke all on function public.preview_staff_status(text) from public, anon, authenticated, service_role;
grant execute on function public.staff_compliance_status() to authenticated, service_role;
grant execute on function public.preview_staff_status(text) to authenticated, service_role;
