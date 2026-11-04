import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// An owner can have several shops with one active at a time (SRD v2.1 A-12). The active one is
// users.active_shop_id; when it is unset or no longer owned, the oldest shop is used. This mirrors
// private.current_shop_id(), which RLS and Storage rely on, so both always agree.
// No "server-only": the proxy needs it too.
export const MAX_SHOPS = 3;

export type ShopRow = Database["public"]["Tables"]["shops"]["Row"];

export async function listShops(supabase: SupabaseClient<Database>, userId: string) {
  const [shops, me] = await Promise.all([
    supabase.from("shops").select("*").eq("owner_id", userId).order("created_at"),
    supabase.from("users").select("active_shop_id").eq("id", userId).maybeSingle(),
  ]);
  if (shops.error || me.error) return { error: true as const, shop: null, shops: [] as ShopRow[] };
  const list = shops.data ?? [];
  const shop = list.find((s) => s.id === me.data?.active_shop_id) ?? list[0] ?? null;
  return { error: false as const, shop, shops: list };
}

export async function findActiveShop(supabase: SupabaseClient<Database>, userId: string) {
  const { error, shop } = await listShops(supabase, userId);
  return { error, shop };
}

/** Points the owner at a shop. The shop must be one they own; callers check that first. */
export async function setActiveShop(supabase: SupabaseClient<Database>, userId: string, shopId: string) {
  const { error } = await supabase.from("users").update({ active_shop_id: shopId }).eq("id", userId);
  return !error;
}
