-- Lets a signed-in, confirmed user create their OWN roster record.
-- Email always comes from the confirmed account; pay status is always 'Volunteer' until the board changes it.
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
  insert into public.coaches (name, email, phone, team, role, pay, pa_resident_10_years)
  values (btrim(p_name), v_email, btrim(coalesce(p_phone, '')), p_team, p_role, 'Volunteer', coalesce(p_pa_resident, false))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.register_self(text, text, text, text, boolean) from public, anon;
grant execute on function public.register_self(text, text, text, text, boolean) to authenticated;
