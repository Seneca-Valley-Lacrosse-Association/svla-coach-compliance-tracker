-- Coach approval workflow. Existing coaches are grandfathered as approved.
alter table public.coaches add column status text not null default 'approved' check (status in ('pending','approved','declined'));

-- Only approved coaches may read/submit against their own record.
create or replace function private.is_coach(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coaches c where c.id = target and c.status = 'approved' and lower(c.email) = private.confirmed_email())
$$;

-- Self-registration now creates a PENDING record (volunteer until the board decides).
create or replace function public.register_self(p_name text, p_phone text, p_team text, p_role text, p_pa_resident boolean)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := private.confirmed_email();
  v_id uuid;
begin
  if v_email is null then raise exception 'Confirm your email address first.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.board_members b where b.email = v_email) then
    raise exception 'Board accounts do not need a coach profile.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.coaches c where lower(c.email) = v_email) then
    raise exception 'Your coach profile already exists.' using errcode = 'P0001';
  end if;
  insert into public.coaches (name, email, phone, team, role, pay, pa_resident_10_years, status)
  values (btrim(p_name), v_email, btrim(coalesce(p_phone, '')), p_team, p_role, 'Volunteer', coalesce(p_pa_resident, false), 'pending')
  returning id into v_id;
  return v_id;
end $$;
