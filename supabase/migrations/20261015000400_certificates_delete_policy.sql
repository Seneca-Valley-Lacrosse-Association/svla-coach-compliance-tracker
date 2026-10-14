-- 3) A coach may still remove a file they just uploaded if the submission failed, but can no longer delete a file that
--    is attached to a submission (that would leave an approved record pointing at nothing).
drop policy if exists certificates_delete_own_upload on storage.objects;
create policy certificates_delete_own_upload on storage.objects for delete to authenticated
  using (bucket_id = 'certificates' and owner_id = (select auth.uid())::text
         and not exists (select 1 from public.submissions s where s.file_path = name));
