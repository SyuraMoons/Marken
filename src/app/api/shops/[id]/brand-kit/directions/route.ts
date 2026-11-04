import { z } from "zod";
import { getOwnedShop } from "@/lib/api/owner";
import { BrandDirections, MAX_BRIEF } from "@/lib/brand-kit";
import { apiError } from "@/lib/http";
import { callModelWithTelemetry } from "@/lib/gateway";
import { FONTS } from "@/lib/studio/layers";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({ brief: z.string().trim().min(1).max(MAX_BRIEF), productId: z.uuid().optional() });

// Create flow step 2: Muse Spark drafts three brand directions (colours, fonts, guidance) from the owner's
// brief. It only suggests; the owner picks one or edits it, and the choice is saved when they generate.
export async function POST(req: Request, ctx: RouteContext<"/api/shops/[id]/brand-kit/directions">) {
  const { id } = await ctx.params;
  const guard = await getOwnedShop(id);
  if (!guard.ok) return guard.response;
  const shop = guard.value;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return apiError("invalid_body", 400);

  const supabase = await createClient();
  const { data: products } = await supabase.from("products").select("id, name, category, description").eq("shop_id", shop.id).limit(10);
  const focus = products?.find((p) => p.id === body.data.productId);
  const fonts = Object.entries(FONTS).map(([key, f]) => `${key} (${f.label})`).join(", ");
  const system = [
    "You are MARKEN's brand designer. From the owner's brief, propose THREE clearly different brand directions for Instagram image posts.",
    "Make them distinct: e.g. one bold and energetic, one calm and premium, one warm and handmade, unless the brief asks otherwise.",
    `Fonts: choose heading_font and body_font ONLY from these ids: ${fonts}.`,
    "colors: 3 to 5 hex colours (#rrggbb), the first being the main brand colour. Prefer colours that suit the product.",
    "name: two or three words naming the direction. summary: one short sentence on who it appeals to.",
    "design_guidance: two or three short sentences about mood, layout and headline voice. photo_style: one short sentence about lighting, surfaces and props.",
    "Never mention prices, discounts or claims. Write in English.",
    'Respond with JSON only: { "directions": [{ "name": string, "summary": string, "colors": string[], "heading_font": string, "body_font": string, "design_guidance": string, "photo_style": string }] } with exactly 3 items.',
  ].join("\n\n");

  try {
    const { data } = await callModelWithTelemetry<string, z.infer<typeof BrandDirections>>({
      step: "brand_directions",
      model: "muse-spark",
      shopId: shop.id,
      systemPrompt: system,
      schema: BrandDirections,
      input: JSON.stringify({
        brief: body.data.brief,
        shop: { name: shop.name, category: shop.category, country: shop.country, description: shop.description, tone: shop.tone },
        product: focus ? { name: focus.name, category: focus.category, description: focus.description } : null,
        other_products: (products ?? []).filter((p) => p.id !== focus?.id).map((p) => p.name),
      }),
    });
    return Response.json(data);
  } catch (e) {
    console.error("brand directions failed", e instanceof Error ? e.message : e);
    return apiError("suggest_failed", 502);
  }
}
