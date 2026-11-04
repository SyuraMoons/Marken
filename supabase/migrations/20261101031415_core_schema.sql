-- MARKEN SRD v2.0 §9 core schema (issue #9).
-- Tables, constraints, indexes, signup trigger and the Approve Gate trigger.
-- RLS lives in the next migration; storage in the one after.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users (mirror of auth.users, filled by trigger on signup)
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  ui_locale text not null default 'en',
  created_at timestamptz not null default now()
);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- shops (one per owner) and server-only secrets
-- ---------------------------------------------------------------------------

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.users (id) on delete cascade,
  name text,
  category text,
  country text,
  content_language text not null default 'en' check (content_language in ('en', 'id')),
  time_zone text,
  tone text,
  notify_time time not null default '08:00',
  ig_account_id text,
  onboarding_step smallint not null default 1 check (onboarding_step between 1 and 5),
  onboarding_completed_at timestamptz,
  tour_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger shops_touch_updated_at
  before update on public.shops
  for each row execute function private.touch_updated_at();

-- ig_token never lives on shops: RLS is per row, so a column there would reach the browser.
create table public.shop_secrets (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  ig_token_encrypted text,
  ig_token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger shop_secrets_touch_updated_at
  before update on public.shop_secrets
  for each row execute function private.touch_updated_at();

-- Resolves the caller's shop id. SECURITY DEFINER so policies can use it without recursing into shops RLS.
create or replace function private.current_shop_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.shops where owner_id = (select auth.uid())
$$;

revoke all on function private.current_shop_id() from public, anon;
grant execute on function private.current_shop_id() to authenticated;

-- ---------------------------------------------------------------------------
-- onboarding_events, style_rules, media_uploads, products
-- ---------------------------------------------------------------------------

create table public.onboarding_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  step smallint not null check (step between 1 and 5),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  skipped boolean not null default false,
  unique (shop_id, step)
);

create table public.style_rules (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  position smallint not null check (position between 1 and 10),
  unique (shop_id, position)
);

create table public.media_uploads (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  storage_path text not null,
  bytes bigint not null check (bytes > 0),
  mime_type text,
  created_at timestamptz not null default now()
);
create index media_uploads_shop_id_idx on public.media_uploads (shop_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  category text,
  price numeric(14, 2) check (price is null or price > 0), -- null when not visible in the photo
  currency text,
  attributes jsonb not null default '[]'::jsonb,
  description text,
  hidden boolean not null default false,
  source_upload_id uuid references public.media_uploads (id) on delete set null, -- owner photo for the before/after toggle
  cutout_path text,
  cutout_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_shop_id_idx on public.products (shop_id);
create index products_source_upload_id_idx on public.products (source_upload_id);

create trigger products_touch_updated_at
  before update on public.products
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- trends and shared 7-day analyses (global, not per shop)
-- ---------------------------------------------------------------------------

create table public.trends (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  type text,
  country text not null default '',
  category text not null default '',
  title text not null,
  url text,
  source_rank integer,
  score smallint check (score between 0 and 100),
  collected_at timestamptz not null default now(),
  -- A stable key lets daily research upsert, so trend_id (and its cached analysis) survives re-collection.
  unique (source, country, category, title)
);
create index trends_collected_at_idx on public.trends (collected_at desc);

create table public.trend_analyses (
  trend_id uuid primary key references public.trends (id) on delete cascade,
  hook text,
  structure text,
  visual_style text,
  scene_brief text,
  why_it_works text,
  from_video boolean not null default false,
  model text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index trend_analyses_expires_at_idx on public.trend_analyses (expires_at);

-- ---------------------------------------------------------------------------
-- posts, revisions, activity
-- ---------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  trend_id uuid references public.trends (id) on delete set null,
  post_date date not null,
  status text not null default 'generating'
    check (status in ('generating', 'ready', 'approved', 'publishing', 'published', 'failed', 'skipped')),
  fit_reason text,
  -- [{order, text, alt, scene_path, slide_path, fidelity_score, fidelity_passed}]
  slides jsonb not null default '[]'::jsonb,
  caption_options jsonb not null default '[]'::jsonb,
  chosen_caption text,
  hashtags text[] not null default '{}',
  skip_reason text,
  ig_media_id text,
  permalink text,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_shop_date_idx on public.posts (shop_id, post_date desc);
create index posts_product_id_idx on public.posts (product_id);
create index posts_trend_id_idx on public.posts (trend_id);
-- Retried jobs must not duplicate a day's post. Skipped/failed posts free the slot so Run now still works.
create unique index posts_one_live_per_shop_day
  on public.posts (shop_id, post_date)
  where status not in ('skipped', 'failed');

create trigger posts_touch_updated_at
  before update on public.posts
  for each row execute function private.touch_updated_at();

-- Approve Gate (FR-TD-02, NFR-16): enforced in the database so no code path can bypass it,
-- including the service role (triggers run regardless of RLS).
create or replace function private.enforce_post_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'generating' then
      raise exception 'new posts must start as generating, got %', new.status
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'generating' and new.status in ('ready', 'failed')) or
    (old.status = 'ready'      and new.status in ('approved', 'skipped')) or
    (old.status = 'approved'   and new.status = 'publishing') or
    (old.status = 'publishing' and new.status in ('published', 'failed')) or
    (old.status = 'failed'     and new.status = 'generating') or
    -- retry a failed publish; a post that failed while generating was never approved
    (old.status = 'failed'     and new.status = 'approved' and old.approved_at is not null)
  ) then
    raise exception 'illegal post status change % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if new.status = 'approved' and old.status = 'ready' then
    new.approved_at := now();
  elsif new.status = 'generating' then
    new.approved_at := null;
  end if;

  return new;
end;
$$;

create trigger posts_enforce_status
  before insert or update of status on public.posts
  for each row execute function private.enforce_post_status();

create table public.post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  target text not null, -- 'caption' | 'slide'
  feedback text,
  output jsonb,
  created_at timestamptz not null default now() -- FR-ED-01: max 5 per post per day
);
create index post_revisions_post_idx on public.post_revisions (post_id, created_at desc);

-- Activity Panel rows (FR-AP-01, NFR-17): live step status, including non-model steps like compositing.
create table public.post_steps (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  step text not null,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'skipped')),
  model text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  detail jsonb
);
create index post_steps_post_idx on public.post_steps (post_id, started_at);
create index post_steps_shop_id_idx on public.post_steps (shop_id);

-- ---------------------------------------------------------------------------
-- model_calls (FR-CL-01). Mirrors ModelCallTelemetry in src/lib/gateway/types.ts.
-- step/model/provider stay plain text: the gateway swallows logger errors, so a CHECK
-- on a new step name would silently drop log rows.
-- ---------------------------------------------------------------------------

create table public.model_calls (
  id uuid primary key, -- supplied by the gateway (randomUUID)
  shop_id uuid references public.shops (id) on delete cascade, -- null for shared trend calls
  post_id uuid references public.posts (id) on delete set null,
  step text not null,
  model text not null,
  requested_model text,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  images integer not null default 0,
  latency_ms integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  cache_hit boolean not null default false,
  fallback boolean not null default false,
  fallback_reason text,
  retries integer not null default 0,
  provider text,
  created_at timestamptz not null default now()
);
create index model_calls_shop_created_idx on public.model_calls (shop_id, created_at desc);
create index model_calls_post_idx on public.model_calls (post_id);
