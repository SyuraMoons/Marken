-- Company description (SRD v2.1 A-06): free text "what you sell and who it's for".
alter table public.shops add column if not exists description text
  check (description is null or char_length(description) <= 1000);

-- Owners write it through their session, like tone (see column_grants).
grant insert (description) on public.shops to authenticated;
grant update (description) on public.shops to authenticated;
