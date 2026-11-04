-- One product per uploaded photo (issue #11). Extraction is retried on failure, and a
-- concurrent double submit must not create duplicate products. NULLs stay allowed.
drop index if exists public.products_source_upload_id_idx;
create unique index products_source_upload_id_key on public.products (source_upload_id);
