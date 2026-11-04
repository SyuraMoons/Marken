"use server";

import { BrandKitInput } from "@/lib/brand-kit";
import { getOwnerShop } from "@/lib/data/today";
import { createClient } from "@/lib/supabase/server";

// Owner-scoped brand kit write through the RLS client (FD-08). Select-then-write, because an upsert would
// need update rights on shop_id, which owners do not have.
export async function saveBrandKit(input: unknown): Promise<{ ok: boolean }> {
  const v = BrandKitInput.safeParse(input);
  const owner = await getOwnerShop();
  if (!owner || !v.success) return { ok: false };
  const row = {
    colors: v.data.colors,
    heading_font: v.data.heading_font,
    body_font: v.data.body_font,
    design_guidance: v.data.design_guidance || null,
    photo_style: v.data.photo_style || null,
  };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("brand_kits").select("id").eq("shop_id", owner.shop.id).maybeSingle();
  const { error } = existing
    ? await supabase.from("brand_kits").update(row).eq("id", existing.id)
    : await supabase.from("brand_kits").insert({ shop_id: owner.shop.id, ...row });
  return { ok: !error };
}
