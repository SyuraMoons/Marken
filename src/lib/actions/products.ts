"use server";

import { z } from "zod";
import { getOwnerShop } from "@/lib/data/today";
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
  if (!(await getOwnerShop()) || !z.uuid().safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  return { ok: !error };
}
