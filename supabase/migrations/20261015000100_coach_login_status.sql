-- Track when a coach was last invited, and let the board see which coaches have a sign-in account.
alter table public.coaches add column if not exists invited_at timestamptz;

-- One row per coach: does a confirmed account exist for their email, and when did they last sign in?
-- Board members only. Matches on lower(email), so a changed address correctly shows "no login".
create or replace function public.coach_login_status()
returns table (email text, has_account boolean, last_sign_in_at timestamptz, invited_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select lower(c.email)::text,
         (u.id is not null and u.email_confirmed_at is not null),
         u.last_sign_in_at,
         c.invited_at
  from public.coaches c
  left join auth.users u on lower(u.email) = lower(c.email)
  where private.is_board()
  order by lower(c.email)
$$;
revoke all on function public.coach_login_status() from public, anon;
grant execute on function public.coach_login_status() to authenticated;
