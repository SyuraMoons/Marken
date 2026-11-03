import "server-only";
import { toBrandKit } from "@/lib/brand-kit";
import { createClient } from "@/lib/supabase/server";

export async function getBrandKit(shopId: string) {
  const { data } = await (await createClient())
    .from("brand_kits")
    .select("colors, heading_font, body_font, design_guidance, photo_style")
    .eq("shop_id", shopId)
    .maybeSingle();
  return toBrandKit(data);
}
