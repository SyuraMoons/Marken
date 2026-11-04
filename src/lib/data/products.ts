import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type ProductView = Tables<"products"> & { cutout_url: string | null };

// Cutouts are private; the owner sees them through short-lived signed URLs (NFR-13).
export async function getProducts(shopId: string): Promise<ProductView[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").eq("shop_id", shopId).order("created_at");
  const rows = data ?? [];
  const paths = rows.flatMap((p) => (p.cutout_path ? [p.cutout_path] : []));
  const signed = paths.length ? await createAdminClient().storage.from("media").createSignedUrls(paths, 3600) : { data: [] };
  const urls = new Map((signed.data ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  return rows.map((p) => ({ ...p, cutout_url: p.cutout_path ? (urls.get(p.cutout_path) ?? null) : null }));
}
