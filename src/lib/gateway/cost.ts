import type { CanonicalModelId, ModelCallTelemetry, ModelId } from "./types";

/**
 * Per-unit pricing table (USD) used to track `cost_usd` in `model_calls` (`FR-CL-01`, `FR-CL-02`)
 * and verify that a finished 3-slide carousel stays under USD 0.10 (`NFR-06`).
 *
 * Typical 3-slide carousel cost breakdown:
 * - plan_post (Muse Spark): ~1,800 in / 900 out ≈ $0.0045
 * - check_rules (Muse Spark): ~800 in / 200 out ≈ $0.0014
 * - 3x render_image (Muse Image): 3 * $0.018 = $0.0540
 * - 3x verify_slide (Muse Spark): 3 * ~$0.0018 = $0.0054
 * Total per finished carousel ≈ $0.0653 (< $0.10 target).
 */
export const MODEL_PRICING_USD: Record<
  CanonicalModelId,
  {
    inputPer1kTokens: number;
    outputPer1kTokens: number;
    perImage: number;
  }
> = {
  "muse-spark": {
    inputPer1kTokens: 0.001,
    outputPer1kTokens: 0.003,
    perImage: 0.0015,
  },
  "muse-wonder": {
    inputPer1kTokens: 0.0015,
    outputPer1kTokens: 0.004,
    perImage: 0,
  },
  "muse-spark-open": {
    inputPer1kTokens: 0.0002,
    outputPer1kTokens: 0.0006,
    perImage: 0,
  },
  "muse-image": {
    inputPer1kTokens: 0,
    outputPer1kTokens: 0,
    perImage: 0.018,
  },
  "sam-3.1": {
    inputPer1kTokens: 0,
    outputPer1kTokens: 0,
    perImage: 0.003,
  },
};

export const CAROUSEL_COST_TARGET_USD = 0.1;

export function normalizeModelId(model: ModelId): CanonicalModelId {
  if (model === "llama") {
    return "muse-spark-open";
  }
  return model;
}

/**
 * Computes USD cost for a single model call rounded to 6 decimal places.
 */
export function calculateCallCostUsd(params: {
  model: ModelId;
  tokensIn: number;
  tokensOut: number;
  images: number;
  cacheHit?: boolean;
}): number {
  if (params.cacheHit) {
    return 0;
  }
  const canonical = normalizeModelId(params.model);
  const pricing = MODEL_PRICING_USD[canonical];
  const tokenCost =
    (Math.max(0, params.tokensIn) / 1000) * pricing.inputPer1kTokens +
    (Math.max(0, params.tokensOut) / 1000) * pricing.outputPer1kTokens;
  const imageCost = Math.max(0, params.images) * pricing.perImage;

  return Number((tokenCost + imageCost).toFixed(6));
}

/**
 * Summarizes total cost and cache savings across a list of `model_calls` rows (`FR-CL-02`).
 */
export function summarizePostCost(calls: ModelCallTelemetry[]): {
  totalCostUsd: number;
  underTarget: boolean;
  totalCalls: number;
  cacheHitCount: number;
  cacheHitShare: number;
  fallbackCount: number;
} {
  const totalCalls = calls.length;
  const cacheHitCount = calls.filter((c) => c.cacheHit).length;
  const fallbackCount = calls.filter((c) => c.fallback).length;
  const totalCostUsd = Number(
    calls.reduce((sum, c) => sum + c.costUsd, 0).toFixed(6),
  );

  return {
    totalCostUsd,
    underTarget: totalCostUsd < CAROUSEL_COST_TARGET_USD,
    totalCalls,
    cacheHitCount,
    cacheHitShare:
      totalCalls > 0 ? Number((cacheHitCount / totalCalls).toFixed(4)) : 0,
    fallbackCount,
  };
}

