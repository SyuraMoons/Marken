"use server";

import { z } from "zod";
import { isValidTimeZone } from "@/lib/api/owner";
import { getOwnerShop } from "@/lib/data/today";
import { createClient } from "@/lib/supabase/server";

// Owner-scoped writes through the RLS client (FD-08); never the admin client.
type Result = { ok: true } | { ok: false };

const Shop = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(120),
  country: z.string().trim().min(2).max(80),
  time_zone: z.string().refine(isValidTimeZone),
  content_language: z.enum(["en", "id"]),
});

export async function saveShop(input: unknown): Promise<Result> {
  const owner = await getOwnerShop();
  const v = Shop.safeParse(input);
  if (!owner || !v.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("shops").update(v.data).eq("id", owner.shop.id);
  return { ok: !error };
}

const Brand = z.object({
  tone: z.string().trim().max(500),
  rules: z.array(z.string().trim().min(1).max(200)).max(10),
});

export async function saveBrand(input: unknown): Promise<Result> {
  const owner = await getOwnerShop();
  const v = Brand.safeParse(input);
  if (!owner || !v.success) return { ok: false };
  const supabase = await createClient();
  const shopId = owner.shop.id;
  const up = await supabase.from("shops").update({ tone: v.data.tone }).eq("id", shopId);
  if (up.error) return { ok: false };
  const rows = v.data.rules.map((text, i) => ({ shop_id: shopId, text, position: i + 1 }));
  // Upsert by position first, then drop extras, so a mid-way failure never wipes rules.
  if (rows.length) {
    const { error } = await supabase.from("style_rules").upsert(rows, { onConflict: "shop_id,position" });
    if (error) return { ok: false };
  }
  const { error } = await supabase.from("style_rules").delete().eq("shop_id", shopId).gt("position", rows.length);
  return { ok: !error };
}

const Reminder = z.object({ notify_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) });

export async function saveReminder(input: unknown): Promise<Result> {
  const owner = await getOwnerShop();
  const v = Reminder.safeParse(input);
  if (!owner || !v.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("shops").update(v.data).eq("id", owner.shop.id);
  return { ok: !error };
}
