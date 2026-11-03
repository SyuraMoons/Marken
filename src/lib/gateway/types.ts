import type { ZodType } from "zod";

/**
 * Canonical model identifiers in SRD v2.0 §4 & §9.
 * "llama" is kept as a backward-compatible alias for "muse-spark-open".
 */
export type CanonicalModelId =
  | "muse-spark"
  | "muse-wonder"
  | "muse-spark-open"
  | "muse-image"
  | "sam-3.1";

export type ModelId = CanonicalModelId | "llama";

/**
 * Every agent loop step that calls a model through the gateway (SRD v2.0 §4 & §7).
 */
export type Step =
  | "extract_products"
  | "research_trends"
  | "score_trend"
  | "analyse_trend"
  | "plan_post"
  | "check_rules"
  | "cutout"
  | "render_image"
  | "verify_slide"
  | "regenerate_caption"
  | "regenerate_image"
  | "rewrite_slide_text"
  | "suggest_brand_kit"
  | "brand_directions"
  | "draft_brief"
  | "weekly_learning";

export type ModelModality = "text" | "vision-text" | "browse" | "image" | "segmentation";

/**
 * Input envelope for `callModel` / `callModelWithTelemetry`.
 */
export type ModelCall<TInput = unknown, TOutput = unknown> = {
  step: Step;
  model: ModelId;
  shopId?: string;
  postId?: string;
  input: TInput;
  /**
   * Optional system prompt for text / vision-text / browse steps.
   */
  systemPrompt?: string;
  /**
   * Optional Zod schema used to validate structured JSON outputs (NFR-16).
   * If validation fails on attempt 1, the gateway retries once with the validation error.
   */
  schema?: ZodType<TOutput>;
  /**
   * Mark true when serving a cached result (e.g., 7-day trend_analyses cache FR-TR-04)
   * so telemetry still logs a row with `cacheHit: true` and `costUsd: 0`.
   */
  cacheHit?: boolean;
  /**
   * Pre-fetched cached output when `cacheHit` is true.
   */
  cachedOutput?: TOutput;
  /**
   * Override automatic fallback to `muse-spark-open` on text steps (defaults to true for text steps).
   */
  allowFallback?: boolean;
  /**
   * Optional original model requested before a caller-managed fallback (e.g. `muse-wonder` -> `muse-spark`).
   */
  requestedModel?: ModelId;
  /**
   * Mark true when this gateway call is already executing as a caller-managed fallback.
   */
  fallback?: boolean;
  /**
   * Reason for a caller-managed fallback, persisted on `model_calls` at emit time.
   */
  fallbackReason?: string;
};

/**
 * Telemetry record matching `model_calls` table in SRD v2.0 §9 (`FR-CL-01`, `FR-AP-01`).
 */
export type ModelCallTelemetry = {
  id: string;
  shopId: string | null;
  postId: string | null;
  step: Step;
  model: CanonicalModelId;
  requestedModel: CanonicalModelId;
  tokensIn: number;
  tokensOut: number;
  images: number;
  latencyMs: number;
  costUsd: number;
  cacheHit: boolean;
  fallback: boolean;
  fallbackReason?: string;
  retries: number;
  provider: "meta" | "spark-open" | "mock" | "cache";
  createdAt: string;
};

export type ModelCallResult<TOutput> = {
  data: TOutput;
  telemetry: ModelCallTelemetry;
};

/**
 * Low-level provider execution request.
 */
export type ProviderRequest<TInput = unknown> = {
  step: Step;
  model: CanonicalModelId;
  input: TInput;
  systemPrompt?: string;
  expectJson: boolean;
  retryValidationError?: string;
};

/**
 * Low-level provider execution response before Zod parsing and cost calculation.
 */
export type ProviderRawResponse = {
  rawOutput: unknown;
  tokensIn: number;
  tokensOut: number;
  images: number;
  provider: "meta" | "spark-open" | "mock";
};

export type TelemetryLogger = (
  telemetry: ModelCallTelemetry,
) => void | Promise<void>;

