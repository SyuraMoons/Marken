-- Several companies per owner (SRD v2.1 A-12). An owner picks one active shop; every RLS policy
-- and the Storage policy keep scoping through private.current_shop_id(), so data stays separate.

alter table public.shops drop constraint if exists shops_owner_id_key;
create index if not exists shops_owner_id_idx on public.shops (owner_id, created_at);

-- Deleting the active shop clears the pointer; current_shop_id() then falls back to the oldest shop.
alter table public.users
  add column if not exists active_shop_id uuid references public.shops (id) on delete set null;

-- The active shop if the caller owns it, otherwise the caller's oldest shop. Ownership is re-checked
-- on every call, so a forged active_shop_id can never reach another owner's data.
create or replace function private.current_shop_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.shops s
  where s.owner_id = (select auth.uid())
  order by coalesce(
    s.id = (select u.active_shop_id from public.users u where u.id = (select auth.uid())),
    false
  ) desc, s.created_at asc
  limit 1
$$;

revoke all on function private.current_shop_id() from public, anon;
grant execute on function private.current_shop_id() to authenticated;

-- At most one unfinished (still in onboarding) shop per owner. This keeps first-visit creation and
-- "Add company" race-safe now that owner_id is no longer unique.
create unique index if not exists shops_one_unfinished_per_owner
  on public.shops (owner_id) where onboarding_completed_at is null;
