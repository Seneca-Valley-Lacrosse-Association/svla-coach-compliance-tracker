-- Board-only: remove a person's sign-in account. Refuses board members and the caller's own account.
create or replace function public.delete_account(p_email text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(btrim(p_email));
begin
  if not private.is_board() then raise exception 'Board access is required.' using errcode = 'P0001'; end if;
  if v_email = private.confirmed_email() then raise exception 'You cannot remove your own account.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.board_members b where b.email = v_email) then return false; end if;
  delete from auth.users where lower(email) = v_email;
  return found;
end $$;
revoke all on function public.delete_account(text) from public, anon;
grant execute on function public.delete_account(text) to authenticated;
