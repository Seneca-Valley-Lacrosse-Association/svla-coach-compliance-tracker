-- Confirmed accounts that are neither on the coach roster nor the board. Board members only.
create or replace function public.pending_accounts()
returns table (email text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select lower(u.email)::text, u.created_at
  from auth.users u
  where private.is_board()
    and u.email_confirmed_at is not null
    and not exists (select 1 from public.coaches c where lower(c.email) = lower(u.email))
    and not exists (select 1 from public.board_members b where b.email = lower(u.email))
  order by u.created_at desc
$$;
revoke all on function public.pending_accounts() from public, anon;
grant execute on function public.pending_accounts() to authenticated;
