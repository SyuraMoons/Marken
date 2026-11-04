"use server";

import { z } from "zod";
import { getOwnerShop } from "@/lib/data/today";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Owner-scoped product writes through the RLS client (FD-08).
type Result = { ok: boolean };

const Edit = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(120).nullable().optional(),
  // null means the price is not shown anywhere: never invent one (FR-SP-02).
  price: z.number().positive().nullable().optional(),
  currency: z.string().trim().max(10).nullable().optional(),
  attributes: z.union([z.array(z.string().max(120)).max(30), z.record(z.string().max(60), z.string().max(120))]).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export async function saveProduct(input: unknown): Promise<Result> {
  const v = Edit.safeParse(input);
  if (!(await getOwnerShop()) || !v.success) return { ok: false };
  const { id, ...patch } = v.data;
  const supabase = await createClient();
  const { error } = await supabase.from("products").update(patch).eq("id", id);
  return { ok: !error };
}

export async function setCutoutConfirmed(id: string, confirmed: boolean): Promise<Result> {
  if (!(await getOwnerShop()) || !z.uuid().safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ cutout_confirmed: confirmed }).eq("id", id);
  return { ok: !error };
}

export async function deleteProduct(id: string): Promise<Result> {
  const owner = await getOwnerShop();
  if (!owner || !z.uuid().safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("source_upload_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false };

  // Drop the source photo too, so an upload without a product always means "not prepared yet" (onboarding step 2).
  if (product?.source_upload_id) {
    const admin = createAdminClient();
    const { data: upload } = await admin
      .from("media_uploads")
      .select("storage_path")
      .eq("id", product.source_upload_id)
      .eq("shop_id", owner.shop.id)
      .maybeSingle();
    if (upload) {
      await admin.from("media_uploads").delete().eq("id", product.source_upload_id).eq("shop_id", owner.shop.id);
      await admin.storage.from("media").remove([upload.storage_path]);
    }
  }
  return { ok: true };
}

// Drops a saved photo that never became a product (onboarding step 2). A photo that did is removed with its product.
export async function removeUpload(id: string): Promise<Result> {
  const owner = await getOwnerShop();
  if (!owner || !z.uuid().safeParse(id).success) return { ok: false };
  const admin = createAdminClient();
  const { count } = await admin.from("products").select("id", { count: "exact", head: true }).eq("source_upload_id", id);
  if (count) return { ok: false };
  const { data: upload } = await admin.from("media_uploads").select("storage_path").eq("id", id).eq("shop_id", owner.shop.id).maybeSingle();
  if (!upload) return { ok: false };
  const { error } = await admin.from("media_uploads").delete().eq("id", id).eq("shop_id", owner.shop.id);
  if (error) return { ok: false };
  await admin.storage.from("media").remove([upload.storage_path]);
  return { ok: true };
}
