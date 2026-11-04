// Daily 3-Slide Carousel Planner & Rotation Guard (SRD v2.0 §7.4 — FR-CG-01, FR-CG-02, FR-SP-06, F-08).
// 1. `selectEligibleProductsAndTrends`: Rotates products (no same product two days running)
//    and filters skipped trends against the last 7 posts (`FR-CG-02`).
// 2. `planDailyCarousel`: Uses `Muse Spark` (`muse-spark-1.3`) to plan a 3-slide carousel
//    (hook, product, cta), 2 caption options, and 5-15 hashtags in the shop's language,
//    with automatic rule checking (`checkStyleRules`) and 1x regeneration on failure (`FR-SP-06`).

import { z } from "zod";
import { callModelWithTelemetry, type ModelCallTelemetry } from "../gateway";
import { checkStyleRules, type CheckStyleRulesResult } from "./rules";
import { CarouselPlanModelSchema } from "./schemas";

export type SlideRole = "hook" | "product" | "cta";

export type SlidePlan = {
  order: number;
  role: SlideRole;
  text: string;
  alt: string;
  sceneBrief: string;
  headline?: string;
  subline?: string;
  bigWord?: string;
  templateId?: "product-highlight" | "product-poster" | "product-with-name" | "big-type-behind" | "color-block" | "pedestal-hero" | "tilted-hero";
};

export type CarouselCaptionOption = {
  label: string;
  text: string;
};

export type DailyCarouselPlanResult = {
  productId: string;
  trendId: string;
  fitReason: string;
  slides: SlidePlan[];
  captions: CarouselCaptionOption[];
  captionOptions: string[];
  hashtags: string[];
  rulesPassed: boolean;
  ruleViolations: string[];
  flagged: boolean;
  attempts: number;
  telemetry: ModelCallTelemetry[];
};

export type PostHistoryItem = {
  id?: string;
  postDate: string;
  productId: string | null;
  trendId: string | null;
  status: string;
};

export type ProductCandidate = {
  id: string;
  name: string | null;
  category?: string | null;
  price?: number | null;
  currency?: string | null;
  attributes?: string[];
  description?: string | null;
  cutoutPath?: string | null;
};

export type TrendCandidateForPlan = {
  id: string;
  title: string;
  hook?: string;
  structure?: string;
  visualStyle?: string;
  sceneBrief?: string;
  whyItWorks?: string;
  fromVideo?: boolean;
};

export type SelectEligibleInput = {
  products: ProductCandidate[];
  trends: TrendCandidateForPlan[];
  last7Posts?: PostHistoryItem[];
};

export type SelectEligibleResult = {
  selectedProduct: ProductCandidate;
  selectedTrend: TrendCandidateForPlan;
  eligibleProducts: ProductCandidate[];
  eligibleTrends: TrendCandidateForPlan[];
  rotationReason: string;
};

/**
 * `T-5.2` — Enforces product rotation & skipped trend exclusion (`FR-CG-02`).
 * - No same product two days running (checked against last active post).
 * - Products that went longest without a post get prioritized.
 * - No skipped trend (trends with status === "skipped" in last 7 posts are excluded).
 */
export function selectEligibleProductsAndTrends(
  input: SelectEligibleInput,
): SelectEligibleResult {
  const { products, trends, last7Posts = [] } = input;

  if (products.length === 0) {
    throw new Error("Cannot plan carousel: shop has no products");
  }
  if (trends.length === 0) {
    throw new Error("Cannot plan carousel: no trends available");
  }

  // 1. Identify skipped trends in last 7 posts
  const skippedTrendIds = new Set(
    last7Posts
      .filter((p) => p.status === "skipped" && p.trendId)
      .map((p) => p.trendId!),
  );

  const eligibleTrends = trends.filter((t) => !skippedTrendIds.has(t.id));
  const fallbackTrends = eligibleTrends.length > 0 ? eligibleTrends : trends;

  // Prioritize trend that has not been used recently in the last 7 posts
  const usedTrendIds = new Set(
    last7Posts.filter((p) => p.trendId).map((p) => p.trendId!),
  );
  const selectedTrend =
    fallbackTrends.find((t) => !usedTrendIds.has(t.id)) ?? fallbackTrends[0];

  // 2. Identify the most recent post's product (yesterday's product)
  const sortedHistory = [...last7Posts].sort((a, b) =>
    b.postDate.localeCompare(a.postDate),
  );
  const mostRecentProductId = sortedHistory.find(
    (p) => p.productId && p.status !== "failed" && p.status !== "skipped",
  )?.productId;

  // Filter out the most recent product if there are other products available (no same product two days running)
  let eligibleProducts = products;
  if (products.length > 1 && mostRecentProductId) {
    const withoutYesterday = products.filter((p) => p.id !== mostRecentProductId);
    if (withoutYesterday.length > 0) {
      eligibleProducts = withoutYesterday;
    }
  }

  // Sort eligible products by longest time without a post
  const lastUsedDate = new Map<string, string>();
  for (const post of sortedHistory) {
    if (post.productId && !lastUsedDate.has(post.productId)) {
      lastUsedDate.set(post.productId, post.postDate);
    }
  }

  eligibleProducts.sort((a, b) => {
    const dateA = lastUsedDate.get(a.id) ?? "";
    const dateB = lastUsedDate.get(b.id) ?? "";
    return dateA.localeCompare(dateB); // Oldest/never used first
  });

  const selectedProduct = eligibleProducts[0];

  return {
    selectedProduct,
    selectedTrend,
    eligibleProducts,
    eligibleTrends: fallbackTrends,
    rotationReason: `Selected ${selectedProduct.name ?? selectedProduct.id} (last used: ${lastUsedDate.get(selectedProduct.id) ?? "never"}), paired with trend "${selectedTrend.title}".`,
  };
}

export type PlanDailyCarouselInput = {
  shop: {
    id: string;
    name?: string | null;
    tone?: string | null;
    country?: string;
    category?: string;
    contentLanguage?: "en" | "id";
    styleRules?: string[];
  };
  products: ProductCandidate[];
  trend: TrendCandidateForPlan;
  /** The owner's brief from the create flow (FD-46): what this post is for. Never overrides the truth guardrails. */
  brief?: string;
  last7Posts?: PostHistoryItem[];
  postId?: string;
  maxRetries?: number;
};

/**
 * `T-5.3` — Plans a 3-slide daily carousel via `Muse Spark` (`FR-CG-01`, `FR-SP-06`).
 * Automatically runs `checkStyleRules` and regenerates once if style rules fail.
 */
export async function planDailyCarousel(
  input: PlanDailyCarouselInput,
): Promise<DailyCarouselPlanResult> {
  const shop = input.shop;
  const contentLanguage = shop.contentLanguage ?? "en";
  const styleRules = (shop.styleRules ?? []).slice(0, 10);
  const maxRetries = input.maxRetries ?? 1;

  // Product selection & rotation
  const { selectedProduct, selectedTrend } = selectEligibleProductsAndTrends({
    products: input.products,
    trends: [input.trend],
    last7Posts: input.last7Posts,
  });

  const forbidPrices =
    selectedProduct.price === null ||
    selectedProduct.price === undefined ||
    styleRules.some((r) =>
      /(never|no|don't|do not|without|jangan|tanpa)\b.*\b(price|prices|pricing|cost|harga)/i.test(
        r,
      ),
    );

  const systemPrompt = [
    "You are MARKEN's Daily 3-Slide Carousel Planner (FR-CG-01).",
    "Create a high-converting, authentic 3-slide Instagram carousel plan for a small business selling a physical product.",
    `Content Language: ${contentLanguage === "id" ? "Bahasa Indonesia" : "English"}. All captions, slide headlines, and copy must be in this language.`,
    `Shop Tone: ${shop.tone ?? "warm, authentic, relatable"}.`,
    styleRules.length > 0
      ? `Strict Shop Style Rules:\n${styleRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
      : "",
    forbidPrices
      ? "CRITICAL TRUTH GUARDRAIL (FR-SP-02): NEVER invent or mention any price, cost, discount figure, or currency anywhere in slide text or captions."
      : "",
    input.brief?.trim()
      ? `Owner's brief for this post (follow it for angle, audience and mood, but never invent prices, discounts or claims it does not state): ${input.brief.trim()}`
      : "",
    "Carousel Structure & Contemporary Creative Direction (3 slides, inspired by high-impact visual campaigns):",
    "1. `order: 1`, `role: 'hook'`: Eye-catching problem/curiosity hook. Recommended `template_id: 'big-type-behind'` with a bold 1-word 3D `big_word` behind the product (e.g. 'COLD', 'FRESH', 'PURE') and punchy `headline` (<= 6 words).",
    "2. `order: 2`, `role: 'product'`: Product benefit/craftsmanship spotlight. Recommended `template_id: 'color-block'` or 'pedestal-hero', with clear `headline` and `subline` (<= 12 words).",
    "3. `order: 3`, `role: 'cta'`: Action-driving slide. Recommended `template_id: 'pedestal-hero'` or 'tilted-hero', inviting swipe, tap bio, or DM.",
    "",
    "CRITICAL SCENE BRIEF DIRECTIVE (PRODUCT RELEVANCE):",
    "The `scene_brief` MUST strictly match the PHYSICAL PRODUCT'S REAL-WORLD UTILITY, CATEGORY, AND SENSORY ESSENCE, not random generic trend props.",
    "- For drinkware/tumblers: Cold mist, crisp ice cubes, condensation droplets on a clean icy pedestal, or outdoor morning trail.",
    "- For food/coffee/jars: Warm wooden table, golden sunbeam, morning breakfast setting, rustic ceramic tile.",
    "- For footwear/apparel: Minimalist concrete studio, sleek dynamic floor, soft directional rim lighting.",
    "- For skincare/beauty: Smooth marble surface, clean water ripple, luxury soft-glow studio.",
    "NEVER use generic office unboxing props (like scissors or brown cardboard) unless the product is stationery or packaging.",
    "Camera perspective must be an eye-level or slight low-angle commercial product shot with a clear pedestal or table surface where the product can rest with grounding shadows.",
    "",
    "Provide exactly 2 distinct caption options (Option A & Option B) and 5 to 15 relevant hashtags.",
    'Respond strictly with valid JSON matching: { "product_id": string, "trend_id": string, "fit_reason": string, "slides": [{ "order": 1|2|3, "role": "hook"|"product"|"cta", "headline": string, "subline": string, "big_word": string, "template_id": "big-type-behind"|"color-block"|"pedestal-hero"|"tilted-hero", "text": string, "alt": string, "scene_brief": string }], "caption_options": [string, string], "hashtags": string[] }.',
  ]
    .filter(Boolean)
    .join("\n\n");

  const telemetryList: ModelCallTelemetry[] = [];
  let attempts = 0;
  let finalPlan!: z.infer<typeof CarouselPlanModelSchema>;
  let ruleCheckResult!: CheckStyleRulesResult;

  for (let attempt = 1; attempt <= 1 + maxRetries; attempt++) {
    attempts = attempt;
    const isRetry = attempt > 1;
    const retryCorrection =
      isRetry && ruleCheckResult?.violations.length
        ? `\n\nRETRY CORRECTION REQUIRED: Your previous plan violated shop rules with: ${ruleCheckResult.violations.join("; ")}. Correct these violations immediately.`
        : "";

    const userPrompt = JSON.stringify({
      product: {
        id: selectedProduct.id,
        name: selectedProduct.name,
        category: selectedProduct.category,
        attributes: selectedProduct.attributes ?? [],
        description: selectedProduct.description,
      },
      trend: {
        id: selectedTrend.id,
        title: selectedTrend.title,
        hook: selectedTrend.hook,
        structure: selectedTrend.structure,
        visualStyle: selectedTrend.visualStyle,
        sceneBrief: selectedTrend.sceneBrief,
        whyItWorks: selectedTrend.whyItWorks,
      },
      instructions: `Plan a 3-slide carousel pairing product ${selectedProduct.name ?? selectedProduct.id} with trend "${selectedTrend.title}".${retryCorrection}`,
    });

    const planRes = await callModelWithTelemetry<
      string,
      z.infer<typeof CarouselPlanModelSchema>
    >({
      step: "plan_post",
      model: "muse-spark",
      shopId: shop.id,
      postId: input.postId,
      systemPrompt,
      schema: CarouselPlanModelSchema,
      input: userPrompt,
    });

    telemetryList.push(planRes.telemetry);
    finalPlan = planRes.data;

    // Check style rules & truth guardrail (FR-SP-06)
    const textsToCheck = [
      ...finalPlan.slides.map((s) => s.text),
      ...finalPlan.caption_options,
    ];

    ruleCheckResult = await checkStyleRules({
      texts: textsToCheck,
      shopTone: shop.tone ?? undefined,
      styleRules,
      contentLanguage,
      forbidPrices,
      shopId: shop.id,
      postId: input.postId,
    });
    telemetryList.push(ruleCheckResult.telemetry);

    if (ruleCheckResult.passed) {
      break;
    }
  }

  const slides: SlidePlan[] = finalPlan.slides.map((s) => ({
    order: s.order,
    role: s.role,
    text: s.text.trim(),
    alt: s.alt.trim(),
    sceneBrief: s.scene_brief.trim(),
    headline: s.headline?.trim() || s.text.trim(),
    subline: s.subline?.trim(),
    bigWord: s.big_word?.trim(),
    templateId: s.template_id ?? (s.role === "hook" ? "product-poster" : s.role === "product" ? "product-highlight" : "product-with-name"),
  }));

  const captions: CarouselCaptionOption[] = finalPlan.caption_options.map(
    (text, idx) => ({
      label: idx === 0 ? "A" : idx === 1 ? "B" : String.fromCharCode(65 + idx),
      text: text.trim(),
    }),
  );

  return {
    productId: selectedProduct.id,
    trendId: selectedTrend.id,
    fitReason: finalPlan.fit_reason.trim(),
    slides,
    captions,
    captionOptions: finalPlan.caption_options.map((c) => c.trim()),
    hashtags: finalPlan.hashtags.map((h) =>
      h.startsWith("#") ? h.trim() : `#${h.trim()}`,
    ),
    rulesPassed: ruleCheckResult.passed,
    ruleViolations: ruleCheckResult.violations,
    flagged: !ruleCheckResult.passed,
    attempts,
    telemetry: telemetryList,
  };
}

