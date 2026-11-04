-- Brand kit (SRD v2.1 A-09): one per shop. Colours and fonts feed the text layers on every slide,
-- guidance and photo style are injected into prompts like tone and rules.
create table public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null unique references public.shops (id) on delete cascade,
  colors jsonb not null default '[]'::jsonb
    check (jsonb_typeof(colors) = 'array' and jsonb_array_length(colors) <= 6),
  -- Ids of the fonts bundled in src/lib/studio/fonts (the server has no system fonts).
  heading_font text check (heading_font is null or heading_font in ('poppins-bold', 'poppins', 'bebas', 'dm-serif')),
  body_font text check (body_font is null or body_font in ('poppins-bold', 'poppins', 'bebas', 'dm-serif')),
  design_guidance text check (design_guidance is null or char_length(design_guidance) <= 1000),
  photo_style text check (photo_style is null or char_length(photo_style) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger brand_kits_touch_updated_at
  before update on public.brand_kits
  for each row execute function private.touch_updated_at();

alter table public.brand_kits enable row level security;

create policy brand_kits_own on public.brand_kits
  for all to authenticated
  using (shop_id = (select private.current_shop_id()))
  with check (shop_id = (select private.current_shop_id()));

revoke insert, update, delete, truncate on public.brand_kits from authenticated;
grant select on public.brand_kits to authenticated;
grant insert (shop_id, colors, heading_font, body_font, design_guidance, photo_style) on public.brand_kits to authenticated;
grant update (colors, heading_font, body_font, design_guidance, photo_style) on public.brand_kits to authenticated;
