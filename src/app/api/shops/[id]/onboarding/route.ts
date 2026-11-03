import { z } from "zod";
import { getOwnedShop, isValidTimeZone } from "@/lib/api/owner";
import { apiError, conflict, parseJson } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type ShopUpdate = Database["public"]["Tables"]["shops"]["Update"];

// Save onboarding progress per step and log it (FR-OB-11, FR-OB-12).

const Step1 = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(120),
  country: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).optional(),
  content_language: z.enum(["en", "id"]),
  time_zone: z.string().refine(isValidTimeZone, "invalid time zone"),
});

const Step4 = z.object({
  tone: z.string().trim().max(500).optional(),
  rules: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
});

const Body = z.object({
  step: z.number().int().min(1).max(5),
  action: z.enum(["start", "finish", "skip"]),
  data: z.unknown().optional(),
  tour_completed: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/shops/[id]/onboarding">) {
  const { id } = await ctx.params;
  const guard = await getOwnedShop(id);
  if (!guard.ok) return guard.response;
  const shop = guard.value;

  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  const { step, action, data, tour_completed } = parsed.data;

  // No jumping ahead of the saved step.
  if (step > shop.onboarding_step) {
    return conflict("step_locked", { current_step: shop.onboarding_step });
  }
  if (action === "skip" && step < 4) return apiError("step_required", 400);

  const supabase = await createClient();
  const now = new Date().toISOString();

  if (action === "start") {
    const { error } = await supabase
      .from("onboarding_events")
      .upsert({ shop_id: shop.id, step }, { onConflict: "shop_id,step", ignoreDuplicates: true });
    if (error) return apiError("event_failed", 500);
    return Response.json({ onboarding_step: shop.onboarding_step });
  }

  const shopUpdate: ShopUpdate = {};

  if (action === "finish") {
    if (step === 1) {
      const v = Step1.safeParse(data);
      if (!v.success) return apiError("invalid_data", 400, { issues: v.error.issues });
      Object.assign(shopUpdate, v.data);
    }
    if (step === 2) {
      const { count } = await supabase
        .from("media_uploads")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.id);
      // One photo is enough to start (SRD A-10); more photos are optional.
      if ((count ?? 0) < 1) return conflict("need_a_photo");
    }
    if (step === 3) {
      const { data: products } = await supabase
        .from("products")
        .select("id, cutout_confirmed")
        .eq("shop_id", shop.id)
        .eq("hidden", false);
      if (!products?.length) return conflict("need_a_product");
      if (products.some((p) => !p.cutout_confirmed)) return conflict("unconfirmed_cutouts");
    }
    if (step === 4) {
      const v = Step4.safeParse(data ?? {});
      if (!v.success) return apiError("invalid_data", 400, { issues: v.error.issues });
      if (v.data.tone !== undefined) shopUpdate.tone = v.data.tone;
      // Upsert by position first, then drop extras, so a mid-way failure never wipes rules.
      const rows = v.data.rules.map((text, i) => ({
        shop_id: shop.id,
        text,
        position: i + 1,
      }));
      if (rows.length) {
        const { error } = await supabase
          .from("style_rules")
          .upsert(rows, { onConflict: "shop_id,position" });
        if (error) return apiError("rules_failed", 500);
      }
      const { error: delErr } = await supabase
        .from("style_rules")
        .delete()
        .eq("shop_id", shop.id)
        .gt("position", rows.length);
      if (delErr) return apiError("rules_failed", 500);
    }
  }

  if (step === 5) {
    shopUpdate.onboarding_completed_at = shop.onboarding_completed_at ?? now;
    if (action === "finish" && tour_completed) shopUpdate.tour_completed_at = now;
  }
  // Revisiting an earlier step never lowers the saved step.
  if (step === shop.onboarding_step && step < 5) shopUpdate.onboarding_step = step + 1;

  const { error: eventErr } = await supabase.from("onboarding_events").upsert(
    { shop_id: shop.id, step, finished_at: now, skipped: action === "skip" },
    { onConflict: "shop_id,step" },
  );
  if (eventErr) return apiError("event_failed", 500);

  if (Object.keys(shopUpdate).length) {
    const { error } = await supabase.from("shops").update(shopUpdate).eq("id", shop.id);
    if (error) return apiError("save_failed", 500);
  }

  const { data: fresh } = await supabase.from("shops").select("*").eq("id", shop.id).single();
  return Response.json({ shop: fresh });
}
