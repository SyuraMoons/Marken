import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { listShops, MAX_SHOPS, setActiveShop } from "@/lib/supabase/active-shop";
import { apiError, conflict, unauthorized } from "@/lib/http";

// Add a company (SRD v2.1 A-12) and make it the active one. An owner has at most one unfinished
// company at a time: asking again returns it, so a double tap or a refresh never makes duplicates.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const supabase = await createClient();
  const current = await listShops(supabase, user.id);
  if (current.error) return apiError("shop_lookup_failed", 500);

  const unfinished = current.shops.find((s) => !s.onboarding_completed_at);
  if (unfinished) {
    if (!(await setActiveShop(supabase, user.id, unfinished.id))) return apiError("shop_switch_failed", 500);
    return Response.json({ shop: unfinished });
  }
  if (current.shops.length >= MAX_SHOPS) return conflict("shop_limit", { max: MAX_SHOPS });

  const created = await supabase.from("shops").insert({ owner_id: user.id }).select("*").single();
  if (created.error || !created.data) {
    // Lost a race with a parallel request: the unfinished shop it created now exists.
    if (created.error?.code === "23505") {
      const again = await listShops(supabase, user.id);
      const shop = again.shops.find((s) => !s.onboarding_completed_at);
      if (shop && (await setActiveShop(supabase, user.id, shop.id))) return Response.json({ shop });
    }
    return apiError("shop_create_failed", 500);
  }
  if (!(await setActiveShop(supabase, user.id, created.data.id))) return apiError("shop_switch_failed", 500);
  return Response.json({ shop: created.data }, { status: 201 });
}
