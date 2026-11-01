// Shared Zod schemas for MARKEN AI agents (SRD v2.0 §7 & §9).

import { z } from "zod";

/**
 * Raw schema returned by `Muse Spark` during `extract_products` (`FR-SP-01`, `FR-SP-02`).
 * Includes `price_visible_in_photo` so code can deterministically enforce `price: null`
 * whenever no price is literally printed in the photo.
 */
export const RawProductExtractionModelSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  price_visible_in_photo: z.boolean().default(false),
  price: z.number().positive().nullable().default(null),
  currency: z.string().min(1).max(10).nullable().default(null),
  attributes: z.array(z.string()).default([]),
  description: z.string().min(1),
});

/**
 * Final validated product metadata contract (`FR-SP-01`, `FR-SP-02`).
 */
export const ExtractedProductSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  price: z.number().positive().nullable(),
  currency: z.string().nullable(),
  attributes: z.array(z.string()),
  description: z.string().min(1),
  source_photo: z.string().min(1),
});

export type ExtractedProduct = z.infer<typeof ExtractedProductSchema>;

/**
 * Raw candidate item returned by `Muse Wonder` / `Muse Spark` during `research_trends` (`FR-TR-01`).
 */
export const RawTrendCandidateSchema = z.object({
  source: z
    .enum(["tiktok_creative_center", "google_trends"])
    .default("tiktok_creative_center"),
  type: z
    .enum(["format", "topic", "hashtag", "sound"])
    .default("format"),
  title: z.string().min(1),
  url: z.string().min(1),
  source_rank: z.number().int().positive().default(1),
});

export const TrendResearchModelSchema = z.object({
  candidates: z.array(RawTrendCandidateSchema).min(1),
  pagesVisited: z.array(z.string()).default([]),
});

/**
 * 0-100 scoring schema returned by `Muse Spark Open` during `score_trend` (`FR-TR-05`, `F-16`).
 */
export const TrendScoreModelSchema = z.object({
  fitScore: z.number().min(0).max(100),
  momentumScore: z.number().min(0).max(100),
  rationale: z.string().min(1),
});

/**
 * 7-day cacheable multimodal trend analysis returned by `Muse Spark` (`FR-TR-03..06`, `F-07`).
 */
export const TrendAnalysisModelSchema = z.object({
  hook: z.string().min(1),
  structure: z.string().min(1),
  visual_style: z.string().min(1),
  scene_brief: z.string().min(1),
  why_it_works: z.string().min(1),
  from_video: z.boolean().default(true),
});

/**
 * Style rule verification output schema (`FR-SP-04..06`, `step: "check_rules"`).
 */
export const StyleRuleCheckModelSchema = z.object({
  passed: z.boolean(),
  violations: z.array(z.string()).default([]),
  checkedTextCount: z.number().int().nonnegative().default(0),
});

/**
 * Slide specification within CarouselPlan (`FR-CG-01`).
 */
export const CarouselSlidePlanSchema = z.object({
  order: z.number().int().min(1).max(3),
  role: z.enum(["hook", "product", "cta"]),
  text: z.string().min(1),
  alt: z.string().min(1),
  scene_brief: z.string().min(1),
});

/**
 * Full carousel plan returned by `Muse Spark` (`FR-CG-01`, `step: "plan_post"`).
 */
export const CarouselPlanModelSchema = z.object({
  product_id: z.string().min(1),
  trend_id: z.string().min(1),
  fit_reason: z.string().min(1),
  slides: z.array(CarouselSlidePlanSchema).length(3),
  caption_options: z.array(z.string().min(1)).min(2).max(4),
  hashtags: z.array(z.string().min(1)).min(5).max(15),
});

