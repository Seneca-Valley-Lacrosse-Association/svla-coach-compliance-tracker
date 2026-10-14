-- Last sign-in time for each board member. Board members only.
create or replace function public.board_member_activity()
returns table (email text, last_sign_in_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.email::text, u.last_sign_in_at
  from public.board_members b
  left join auth.users u on lower(u.email) = b.email
  where private.is_board()
  order by b.email
$$;
revoke all on function public.board_member_activity() from public, anon;
grant execute on function public.board_member_activity() to authenticated;
