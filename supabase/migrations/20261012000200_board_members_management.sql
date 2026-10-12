-- Let board members list, add, and remove other board members from the app.
grant insert, delete on public.board_members to authenticated;

create policy board_members_board_read on public.board_members for select to authenticated
  using ((select private.is_board()));
create policy board_members_board_insert on public.board_members for insert to authenticated
  with check ((select private.is_board()));
-- A board member can remove others but never themselves, so the board can never be left empty.
create policy board_members_board_delete on public.board_members for delete to authenticated
  using ((select private.is_board()) and email <> (select private.confirmed_email()));
