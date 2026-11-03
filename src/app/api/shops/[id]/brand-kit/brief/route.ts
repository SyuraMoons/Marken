import { z } from "zod";
import { getOwnedShop } from "@/lib/api/owner";
import { BRIEF_GOALS, DraftedBrief } from "@/lib/brand-kit";
import { apiError } from "@/lib/http";
import { callModelWithTelemetry } from "@/lib/gateway";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({ productId: z.uuid(), goal: z.enum(BRIEF_GOALS).optional() });

// Create flow step 1: Muse Spark writes the brief from what Marken already knows about the shop and product,
// so a first-time owner starts from a filled-in draft instead of an empty box. The owner can edit it freely.
export async function POST(req: Request, ctx: RouteContext<"/api/shops/[id]/brand-kit/brief">) {
  const { id } = await ctx.params;
  const guard = await getOwnedShop(id);
  if (!guard.ok) return guard.response;
  const shop = guard.value;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return apiError("invalid_body", 400);

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("name, category, description, attributes")
    .eq("shop_id", shop.id)
    .eq("id", body.data.productId)
    .maybeSingle();
  if (!product) return apiError("not_found", 404);

  const goal = body.data.goal;
  const system = [
    "You are MARKEN's marketing assistant for small shop owners who have never written a creative brief.",
    "Write a short brief for ONE Instagram image post about the given product, using only what the shop and product data say.",
    goal
      ? `The owner chose this goal: "${goal}". Keep it.`
      : `Pick the goal that fits best from: ${BRIEF_GOALS.join(", ")}. Use "everyday" when unsure.`,
    "audience: who is most likely to buy it, in plain words (one short sentence).",
    "mood: three to five words describing the look and feeling that suits the product and shop.",
    "highlight: the one or two things worth showing about the product, taken from its description or attributes.",
    "Never mention prices, discounts, delivery promises, awards or claims that the data does not state. Write in simple English, no hashtags or emojis.",
    'Respond with JSON only: { "goal": string, "audience": string, "mood": string, "highlight": string }.',
  ].join("\n\n");

  try {
    const { data } = await callModelWithTelemetry<string, z.infer<typeof DraftedBrief>>({
      step: "draft_brief",
      model: "muse-spark",
      shopId: shop.id,
      systemPrompt: system,
      schema: DraftedBrief,
      input: JSON.stringify({
        shop: { name: shop.name, category: shop.category, country: shop.country, description: shop.description, tone: shop.tone },
        product: { name: product.name, category: product.category, description: product.description, attributes: product.attributes },
      }),
    });
    return Response.json({ ...data, goal: goal ?? data.goal });
  } catch (e) {
    console.error("draft brief failed", e instanceof Error ? e.message : e);
    return apiError("suggest_failed", 502);
  }
}
