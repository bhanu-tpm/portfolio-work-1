-- Storage buckets. Private buckets intentionally have NO policies on storage.objects:
-- all reads/writes go through server code (service role) after authorization checks,
-- and downloads use short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('request-files', 'request-files', false, 4194304,
   array['application/pdf', 'image/png', 'image/jpeg',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('outcome-documents', 'outcome-documents', false, 4194304, array['application/pdf']),
  ('resumes', 'resumes', false, 4194304, array['application/pdf']),
  ('public-media', 'public-media', true, 4194304,
   array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
