-- Board members may delete any certificate file (used when a coach record is removed).
create policy certificates_board_delete on storage.objects for delete to authenticated
  using (bucket_id = 'certificates' and (select private.is_board()));
