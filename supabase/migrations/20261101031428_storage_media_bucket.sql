-- Private media bucket (NFR-13): type and size enforced by Storage itself, access via signed URLs.
-- Paths: {shop_id}/uploads|cutouts|scenes|slides/<file>. Writes go through the server (service role).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Owners can read (and therefore request signed URLs for) only their own shop's folder.
create policy media_select_own_shop on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select private.current_shop_id())::text
  );
