-- Row level security (FR-AU-04, NFR-12): every owner reaches only their own shop's data.
-- The service role bypasses RLS; the browser (anon/authenticated) never writes server-owned tables.

-- anon gets nothing, now and for future tables.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

alter table public.users enable row level security;
alter table public.shops enable row level security;
alter table public.shop_secrets enable row level security;
alter table public.onboarding_events enable row level security;
alter table public.style_rules enable row level security;
alter table public.media_uploads enable row level security;
alter table public.products enable row level security;
alter table public.trends enable row level security;
alter table public.trend_analyses enable row level security;
alter table public.posts enable row level security;
alter table public.post_revisions enable row level security;
alter table public.post_steps enable row level security;
alter table public.model_calls enable row level security;

-- users: own row only (rows are created by the signup trigger)
create policy users_select_own on public.users
  for select to authenticated using (id = (select auth.uid()));
create policy users_update_own on public.users
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- shops: own shop; no browser delete (shop deletion runs on the server, NFR-14)
create policy shops_select_own on public.shops
  for select to authenticated using (owner_id = (select auth.uid()));
create policy shops_insert_own on public.shops
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy shops_update_own on public.shops
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- shop_secrets: RLS on, no policies, no grants -> server (service role) only
revoke all on public.shop_secrets from authenticated;

-- owner-managed shop data
create policy onboarding_events_own on public.onboarding_events
  for all to authenticated
  using (shop_id = (select private.current_shop_id()))
  with check (shop_id = (select private.current_shop_id()));

create policy style_rules_own on public.style_rules
  for all to authenticated
  using (shop_id = (select private.current_shop_id()))
  with check (shop_id = (select private.current_shop_id()));

create policy products_own on public.products
  for all to authenticated
  using (shop_id = (select private.current_shop_id()))
  with check (shop_id = (select private.current_shop_id()));

-- server-written, owner-readable
create policy media_uploads_select_own on public.media_uploads
  for select to authenticated using (shop_id = (select private.current_shop_id()));

create policy posts_select_own on public.posts
  for select to authenticated using (shop_id = (select private.current_shop_id()));

create policy post_revisions_select_own on public.post_revisions
  for select to authenticated
  using (exists (
    select 1 from public.posts p
    where p.id = post_revisions.post_id
      and p.shop_id = (select private.current_shop_id())
  ));

create policy post_steps_select_own on public.post_steps
  for select to authenticated using (shop_id = (select private.current_shop_id()));

create policy model_calls_select_own on public.model_calls
  for select to authenticated using (shop_id = (select private.current_shop_id()));

-- shared, read-only for any signed-in owner (FR-TR-04); only the server writes
create policy trends_select_authenticated on public.trends
  for select to authenticated using (true);
create policy trend_analyses_select_authenticated on public.trend_analyses
  for select to authenticated using (true);

-- Browser roles may only write what their policies allow; strip write grants from read-only tables
-- as a second layer.
revoke insert, update, delete, truncate on
  public.media_uploads, public.posts, public.post_revisions, public.post_steps,
  public.model_calls, public.trends, public.trend_analyses
from authenticated;
revoke delete, truncate on public.users, public.shops from authenticated;
revoke insert, delete, truncate on public.users from authenticated;
