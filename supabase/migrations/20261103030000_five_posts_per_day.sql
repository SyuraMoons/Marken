-- Up to 5 live posts per shop per day (was 1). Skipped/failed posts still free their slot.
-- The cap lives in the database so Run now, "Make post" and the cron cannot exceed it,
-- including the service role. Keep in sync with MAX_POSTS_PER_DAY in src/lib/posts/limits.ts.

drop index if exists public.posts_one_live_per_shop_day;

create or replace function private.posts_daily_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  live int;
begin
  if new.status in ('skipped', 'failed') then
    return new;
  end if;
  -- Serialise inserts for one shop-day so two concurrent taps cannot both pass the count.
  perform pg_advisory_xact_lock(hashtextextended(new.shop_id::text || ':' || new.post_date::text, 0));
  select count(*) into live
  from public.posts
  where shop_id = new.shop_id
    and post_date = new.post_date
    and status not in ('skipped', 'failed');
  if live >= 5 then
    raise exception 'daily_post_limit' using errcode = 'MK429', detail = '5';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_daily_cap on public.posts;
create trigger posts_daily_cap
  before insert on public.posts
  for each row execute function private.posts_daily_cap();
