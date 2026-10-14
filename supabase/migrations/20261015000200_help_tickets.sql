-- Help requests ("tickets"): coaches ask for help, the board works them, and a board member can flag a
-- ticket as an internal Bug / Issue for IT. Already applied to the supabase-svla-database project.
-- All access goes through the functions below; the tables themselves are closed to the browser.

-- Where each topic is emailed. All IT for now. To send clearance questions to a clearance coordinator later,
-- update the route_to of the 'clearance_status' and 'upload' rows (see ADMIN.md).
create table public.ticket_routing (
  route_key text primary key,
  route_to  text not null check (route_to = lower(route_to) and char_length(route_to) <= 254),
  note      text
);
alter table public.ticket_routing enable row level security;
revoke all on public.ticket_routing from anon, authenticated;

insert into public.ticket_routing (route_key, route_to, note) values
  ('login',            'it@svlacrosse.org', 'Can''t log in'),
  ('clearance_status', 'it@svlacrosse.org', 'My clearance status looks wrong - future: clearance coordinator'),
  ('upload',           'it@svlacrosse.org', 'Can''t upload a document - future: clearance coordinator'),
  ('broken',           'it@svlacrosse.org', 'Something is broken'),
  ('other',            'it@svlacrosse.org', 'Other'),
  ('bug_alert',        'it@svlacrosse.org', 'Destination for [SVLA BUG] alerts when an admin flags Bug / Issue');

create table public.tickets (
  id               uuid primary key default gen_random_uuid(),
  ticket_no        integer generated always as identity,
  ticket_code      text generated always as ('SVLA-' || lpad(ticket_no::text, 4, '0')) stored,
  submitted_by     uuid references auth.users(id) on delete set null,
  coach_name       text not null check (char_length(coach_name) <= 120),
  coach_email      text not null check (char_length(coach_email) <= 254),
  topic            text not null check (topic in ('login','clearance_status','upload','broken','other')),
  description      text not null check (char_length(btrim(description)) between 1 and 2000),
  page_context     jsonb not null default '{}'::jsonb check (octet_length(page_context::text) <= 1000),
  status           text not null default 'open' check (status in ('open','in_progress','resolved','bug_issue')),
  admin_notes      text check (char_length(admin_notes) <= 2000),
  flagged_by       uuid references auth.users(id) on delete set null,
  flagged_by_email text,
  flagged_at       timestamptz,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);
create index tickets_status_idx  on public.tickets (status);
create index tickets_created_idx on public.tickets (created_at desc);
alter table public.tickets enable row level security;
revoke all on public.tickets from anon, authenticated;

-- Submit a ticket (coach or board member). Validates, rate-limits, and returns what is needed to send the emails.
create or replace function public.submit_ticket(p_topic text, p_description text, p_context jsonb default '{}'::jsonb)
returns table(id uuid, ticket_code text, topic text, description text, page_context jsonb,
              coach_name text, coach_email text, route_to text)
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := private.confirmed_email();
  v_name  text;
  v_ctx   jsonb;
  v_route text;
  v_id    uuid;
begin
  if v_email is null or (select auth.uid()) is null then
    raise exception 'Sign in to request help.' using errcode = 'P0001';
  end if;
  if p_topic not in ('login','clearance_status','upload','broken','other') then
    raise exception 'Choose a topic.' using errcode = 'P0001';
  end if;
  if btrim(coalesce(p_description,'')) = '' or char_length(p_description) > 2000 then
    raise exception 'Describe the problem in 2,000 characters or fewer.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.tickets t
        where t.submitted_by = (select auth.uid()) and t.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many requests. Please email it@svlacrosse.org.' using errcode = 'P0001';
  end if;

  select c.name into v_name from public.coaches c where lower(c.email) = v_email limit 1;
  v_name := coalesce(v_name, v_email);

  -- keep only a few short context fields
  v_ctx := jsonb_strip_nulls(jsonb_build_object(
    'page',    left(coalesce(p_context->>'page',''), 200),
    'item',    left(coalesce(p_context->>'item',''), 120),
    'team',    left(coalesce(p_context->>'team',''), 40),
    'browser', left(coalesce(p_context->>'browser',''), 200)
  ));

  select r.route_to into v_route from public.ticket_routing r where r.route_key = p_topic;
  v_route := coalesce(v_route, 'it@svlacrosse.org');

  insert into public.tickets as t (submitted_by, coach_name, coach_email, topic, description, page_context)
  values ((select auth.uid()), v_name, v_email, p_topic, btrim(p_description), v_ctx)
  returning t.id into v_id;

  return query
    select t.id, t.ticket_code, t.topic, t.description, t.page_context, t.coach_name, t.coach_email, v_route
    from public.tickets t where t.id = v_id;
end $$;

-- A person's own tickets. The internal Bug / Issue status is shown as In Progress.
create or replace function public.my_tickets()
returns table(id uuid, ticket_code text, topic text, description text, display_status text,
              created_at timestamptz, resolved_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.id, t.ticket_code, t.topic, t.description,
         case t.status when 'open' then 'Open'
                       when 'resolved' then 'Resolved'
                       else 'In Progress' end,
         t.created_at, t.resolved_at
  from public.tickets t
  where t.submitted_by = (select auth.uid())
  order by t.created_at desc
$$;

-- Board: every ticket, unresolved first.
create or replace function public.admin_tickets()
returns table(id uuid, ticket_code text, coach_name text, coach_email text, topic text, description text,
              page_context jsonb, status text, admin_notes text, flagged_by_email text, flagged_at timestamptz,
              created_at timestamptz, resolved_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.id, t.ticket_code, t.coach_name, t.coach_email, t.topic, t.description, t.page_context,
         t.status, t.admin_notes, t.flagged_by_email, t.flagged_at, t.created_at, t.resolved_at
  from public.tickets t
  where private.is_board()
  order by (t.status = 'resolved'), t.created_at desc
$$;

create or replace function public.admin_open_ticket_count()
returns integer language sql stable security definer set search_path = '' as $$
  select case when private.is_board()
              then (select count(*)::int from public.tickets t where t.status <> 'resolved') end
$$;

-- Board: change status and/or note. send_bug_alert is true only the first time a ticket is flagged Bug / Issue.
create or replace function public.admin_update_ticket(p_id uuid, p_status text default null, p_note text default null)
returns table(ticket_code text, topic text, description text, page_context jsonb, status text,
              admin_notes text, flagged_by_email text, send_bug_alert boolean, bug_route_to text)
language plpgsql security definer set search_path = '' as $$
declare
  t public.tickets;
  v_alert boolean := false;
  v_email text := private.confirmed_email();
begin
  if not private.is_board() then raise exception 'Board access is required.' using errcode = 'P0001'; end if;
  if p_status is not null and p_status not in ('open','in_progress','resolved','bug_issue') then
    raise exception 'Invalid status.' using errcode = 'P0001';
  end if;
  if p_note is not null and char_length(p_note) > 2000 then
    raise exception 'Note must be 2,000 characters or fewer.' using errcode = 'P0001';
  end if;

  select * into t from public.tickets x where x.id = p_id for update;
  if t.id is null then raise exception 'Ticket not found.' using errcode = 'P0001'; end if;

  if p_status = 'bug_issue' and t.flagged_at is null then
    v_alert := true;
    t.flagged_by := (select auth.uid());
    t.flagged_by_email := v_email;
    t.flagged_at := now();
  end if;
  if p_status is not null then
    t.status := p_status;
    t.resolved_at := case when p_status = 'resolved' then coalesce(t.resolved_at, now()) else null end;
  end if;
  if p_note is not null then t.admin_notes := nullif(btrim(p_note), ''); end if;

  update public.tickets x
     set status = t.status, resolved_at = t.resolved_at, admin_notes = t.admin_notes,
         flagged_by = t.flagged_by, flagged_by_email = t.flagged_by_email, flagged_at = t.flagged_at
   where x.id = p_id;

  return query
    select t.ticket_code, t.topic, t.description, t.page_context, t.status, t.admin_notes, t.flagged_by_email,
           v_alert,
           coalesce((select r.route_to from public.ticket_routing r where r.route_key = 'bug_alert'), 'it@svlacrosse.org');
end $$;

revoke execute on function public.submit_ticket(text,text,jsonb)      from public, anon;
revoke execute on function public.my_tickets()                        from public, anon;
revoke execute on function public.admin_tickets()                     from public, anon;
revoke execute on function public.admin_open_ticket_count()           from public, anon;
revoke execute on function public.admin_update_ticket(uuid,text,text) from public, anon;
grant  execute on function public.submit_ticket(text,text,jsonb)      to authenticated;
grant  execute on function public.my_tickets()                        to authenticated;
grant  execute on function public.admin_tickets()                     to authenticated;
grant  execute on function public.admin_open_ticket_count()           to authenticated;
grant  execute on function public.admin_update_ticket(uuid,text,text) to authenticated;
