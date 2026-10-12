-- Keep the access-check helpers out of the public API schema (Supabase advisor 0029).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter function public.confirmed_email() set schema private;
alter function public.is_board() set schema private;
alter function public.is_coach(uuid) set schema private;
revoke all on function private.confirmed_email(), private.is_board(), private.is_coach(uuid) from public, anon;
grant execute on function private.confirmed_email(), private.is_board(), private.is_coach(uuid) to authenticated;

create or replace function private.is_board()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.board_members b where b.email = private.confirmed_email())
$$;
create or replace function private.is_coach(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coaches c where c.id = target and lower(c.email) = private.confirmed_email())
$$;
