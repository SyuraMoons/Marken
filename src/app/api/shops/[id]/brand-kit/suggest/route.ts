import { getOwnedShop } from "@/lib/api/owner";
import { BrandKitSuggestion } from "@/lib/brand-kit";
import { apiError } from "@/lib/http";
import { callModelWithTelemetry } from "@/lib/gateway";
import { FONTS } from "@/lib/studio/layers";
import { createClient } from "@/lib/supabase/server";
import type { z } from "zod";

// "Fill in from my description" (SRD A-09): Muse Spark drafts colours, fonts and style from what the owner
// wrote about the business. It only suggests; the owner edits and saves, nothing is stored here.
export async function POST(_req: Request, ctx: RouteContext<"/api/shops/[id]/brand-kit/suggest">) {
  const { id } = await ctx.params;
  const guard = await getOwnedShop(id);
  if (!guard.ok) return guard.response;
  const shop = guard.value;
  if (!shop.description?.trim()) return apiError("description_required", 409);

  const { data: products } = await (await createClient()).from("products").select("name").eq("shop_id", shop.id).limit(10);
  const fonts = Object.entries(FONTS).map(([key, f]) => `${key} (${f.label})`).join(", ");
  const system = [
    "You are MARKEN's brand designer. From a short business description, propose a small brand kit for Instagram posts.",
    `Fonts: choose heading_font and body_font ONLY from these ids: ${fonts}.`,
    "colors: 3 to 5 hex colours (#rrggbb), the first being the main brand colour. Prefer colours that suit the products.",
    "design_guidance: two or three short sentences about mood, layout and the voice of the headlines. photo_style: one short sentence about lighting, surfaces and props.",
    "Never mention prices, discounts or claims. Write in English.",
    'Respond with JSON only: { "colors": string[], "heading_font": string, "body_font": string, "design_guidance": string, "photo_style": string }.',
  ].join("\n\n");

  try {
    const { data } = await callModelWithTelemetry<string, z.infer<typeof BrandKitSuggestion>>({
      step: "suggest_brand_kit",
      model: "muse-spark",
      shopId: shop.id,
      systemPrompt: system,
      schema: BrandKitSuggestion,
      input: JSON.stringify({
        name: shop.name,
        category: shop.category,
        country: shop.country,
        description: shop.description,
        tone: shop.tone,
        products: (products ?? []).map((p) => p.name),
      }),
    });
    return Response.json({ kit: data });
  } catch (e) {
    console.error("brand kit suggest failed", e instanceof Error ? e.message : e);
    return apiError("suggest_failed", 502);
  }
}
