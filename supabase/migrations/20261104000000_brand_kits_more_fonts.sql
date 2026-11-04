-- #65 bundled ten more fonts in src/lib/studio/fonts, but the brand_kits checks still allowed only the
-- original four, so saving a kit (or picking a brand direction) with e.g. montserrat failed the insert.
-- Keep this list in sync with FONTS in src/lib/studio/layers.ts.
alter table public.brand_kits drop constraint brand_kits_heading_font_check;
alter table public.brand_kits drop constraint brand_kits_body_font_check;

alter table public.brand_kits add constraint brand_kits_heading_font_check check (
  heading_font is null or heading_font in (
    'poppins-bold', 'poppins', 'bebas', 'dm-serif', 'montserrat-bold', 'montserrat', 'space-grotesk-bold',
    'space-grotesk', 'science-gothic', 'forum', 'italiana', 'cambo', 'cherry-cream-soda', 'amethysta'
  )
);
alter table public.brand_kits add constraint brand_kits_body_font_check check (
  body_font is null or body_font in (
    'poppins-bold', 'poppins', 'bebas', 'dm-serif', 'montserrat-bold', 'montserrat', 'space-grotesk-bold',
    'space-grotesk', 'science-gothic', 'forum', 'italiana', 'cambo', 'cherry-cream-soda', 'amethysta'
  )
);
