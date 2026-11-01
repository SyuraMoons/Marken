-- Column level write grants for the browser role (NFR-12, F-26).
-- RLS limits which rows an owner can write, not which columns. Two columns must stay
-- server-owned:
--   products.cutout_path   points at the file the fidelity check compares against; if an
--                          owner session could repoint it, "Real product" would not be
--                          provable.
--   shops.ig_account_id    decides whether Approve queues an Instagram publish; only the
--                          OAuth callback may set it.
-- Owners keep every column the app writes through their session (onboarding, settings,
-- product edits, cutout confirmation). The service role is unaffected.

revoke insert, update on public.products from authenticated;
grant insert (shop_id, name, category, price, currency, attributes, description, hidden, source_upload_id)
  on public.products to authenticated;
grant update (name, category, price, currency, attributes, description, hidden, cutout_confirmed)
  on public.products to authenticated;

revoke insert, update on public.shops from authenticated;
grant insert (owner_id, name, category, country, content_language, time_zone, tone, notify_time,
              onboarding_step, onboarding_completed_at, tour_completed_at)
  on public.shops to authenticated;
grant update (name, category, country, content_language, time_zone, tone, notify_time,
              onboarding_step, onboarding_completed_at, tour_completed_at)
  on public.shops to authenticated;
