-- A coach (or a board member) can remove a requirement's entry: every submission this coach has for that requirement
-- is deleted, so the requirement goes back to "not started" and the dates are cleared. The function returns the
-- storage paths so the app can delete the uploaded files too.
create or replace function public.remove_submission(p_id uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  paths text[];
begin
  select * into s from public.submissions where id = p_id;
  if s.id is null then raise exception 'Submission not found.' using errcode = 'P0001'; end if;
  if not (private.is_board() or private.is_coach(s.coach_id)) then
    raise exception 'You do not have access to remove this.' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(file_path) filter (where file_path is not null), '{}') into paths
    from public.submissions where coach_id = s.coach_id and requirement_id = s.requirement_id;
  delete from public.submissions where coach_id = s.coach_id and requirement_id = s.requirement_id;
  return paths;
end $$;

revoke all on function public.remove_submission(uuid) from public, anon;
grant execute on function public.remove_submission(uuid) to authenticated;
