// The ONLY path to any model (FR-CL-01). Routes a step to a model, validates JSON
// output (NFR-16), logs a model_calls row with cost (FR-CL-02), and falls back to
// Muse Spark Open for text when the Meta Model API fails (NFR-18).
// Provider clients live in ./providers and must not be imported elsewhere.

import { randomUUID } from "node:crypto";
import type { ZodType } from "zod";
import {
  CAROUSEL_COST_TARGET_USD,
  MODEL_PRICING_USD,
  calculateCallCostUsd,
  normalizeModelId,
  summarizePostCost,
} from "./cost";
import { callMetaProvider, isMetaConfigured } from "./providers/meta";
import { callMockProvider } from "./providers/mock";
import {
  callSparkOpenProvider,
  isSparkOpenConfigured,
} from "./providers/spark-open";
import type {
  CanonicalModelId,
  ModelCall,
  ModelCallResult,
  ModelCallTelemetry,
  ModelId,
  ProviderRawResponse,
  Step,
  TelemetryLogger,
} from "./types";

export {
  CAROUSEL_COST_TARGET_USD,
  MODEL_PRICING_USD,
  calculateCallCostUsd,
  normalizeModelId,
  summarizePostCost,
};
export type {
  CanonicalModelId,
  ModelCall,
  ModelCallResult,
  ModelCallTelemetry,
  ModelId,
  Step,
  TelemetryLogger,
};

const TEXT_FALLBACK_STEPS: ReadonlySet<Step> = new Set<Step>([
  "extract_products",
  "research_trends",
  "score_trend",
  "analyse_trend",
  "plan_post",
  "check_rules",
  "verify_slide",
  "regenerate_caption",
  "weekly_learning",
]);

const MAX_RECENT_TELEMETRY = 200;
const recentTelemetryLog: ModelCallTelemetry[] = [];
// Kept on globalThis: instrumentation and route handlers can be bundled separately,
// and a module-level Set would then drop every registered logger.
const globalTelemetry = globalThis as typeof globalThis & {
  __marken_telemetry_listeners?: Set<TelemetryLogger>;
};
const telemetryListeners = (globalTelemetry.__marken_telemetry_listeners ??=
  new Set<TelemetryLogger>());

/**
 * Registers a persistence callback (e.g. Harfi's `model_calls` Supabase writer or Inngest step logger).
 * Returns an unsubscribe function.
 */
export function registerTelemetryLogger(logger: TelemetryLogger): () => void {
  telemetryListeners.add(logger);
  return () => {
    telemetryListeners.delete(logger);
  };
}

/**
 * Returns recorded telemetry rows in memory (optionally filtered by `postId` or `shopId`).
 */
export function getRecordedTelemetry(filter?: {
  postId?: string;
  shopId?: string;
}): ModelCallTelemetry[] {
  return recentTelemetryLog.filter((item) => {
    if (filter?.postId && item.postId !== filter.postId) return false;
    if (filter?.shopId && item.shopId !== filter.shopId) return false;
    return true;
  });
}

export function clearRecordedTelemetry(): void {
  recentTelemetryLog.length = 0;
}

async function emitTelemetry(telemetry: ModelCallTelemetry): Promise<void> {
  recentTelemetryLog.push(telemetry);
  if (recentTelemetryLog.length > MAX_RECENT_TELEMETRY) {
    recentTelemetryLog.shift();
  }
  for (const listener of telemetryListeners) {
    try {
      await listener(telemetry);
    } catch {
      // Telemetry sink errors must not crash the user-facing agent pipeline
    }
  }
}

function parseJsonIfNeeded(raw: unknown): unknown {
  if (typeof raw !== "string") {
    return raw;
  }
  const trimmed = raw.trim();
  // Strip optional markdown ```json ... ``` wrapper if a model emitted fences
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (unfenced.startsWith("{") || unfenced.startsWith("[")) {
    return JSON.parse(unfenced);
  }
  return raw;
}

function validateWithSchema<TOutput>(
  raw: unknown,
  schema?: ZodType<TOutput>,
): TOutput {
  const parsed = schema ? parseJsonIfNeeded(raw) : raw;
  if (!schema) {
    return parsed as TOutput;
  }
  return schema.parse(parsed);
}

async function dispatchProvider(params: {
  step: Step;
  model: CanonicalModelId;
  input: unknown;
  systemPrompt?: string;
  expectJson: boolean;
  retryValidationError?: string;
  allowFallback: boolean;
}): Promise<{
  response: ProviderRawResponse;
  effectiveModel: CanonicalModelId;
  fallback: boolean;
  fallbackReason?: string;
}> {
  const canFallbackToSparkOpen =
    params.allowFallback &&
    params.model !== "muse-spark-open" &&
    TEXT_FALLBACK_STEPS.has(params.step);

  // Direct call to Muse Spark Open (e.g., score_trend FR-TR-05)
  if (params.model === "muse-spark-open") {
    if (isSparkOpenConfigured()) {
      const response = await callSparkOpenProvider(params);
      return {
        response,
        effectiveModel: "muse-spark-open",
        fallback: false,
      };
    }
    const response = await callMockProvider(params);
    return {
      response,
      effectiveModel: "muse-spark-open",
      fallback: false,
    };
  }

  // Primary Meta Model API path (`muse-spark`, `muse-wonder`, `muse-image`, `sam-3.1`)
  if (isMetaConfigured()) {
    try {
      const response = await callMetaProvider(params);
      return {
        response,
        effectiveModel: params.model,
        fallback: false,
      };
    } catch (primaryErr) {
      if (!canFallbackToSparkOpen) {
        throw primaryErr;
      }
      const fallbackReason =
        primaryErr instanceof Error ? primaryErr.message : String(primaryErr);

      if (isSparkOpenConfigured()) {
        const response = await callSparkOpenProvider({
          ...params,
          model: "muse-spark-open",
        });
        return {
          response,
          effectiveModel: "muse-spark-open",
          fallback: true,
          fallbackReason,
        };
      }

      const response = await callMockProvider({
        ...params,
        model: "muse-spark-open",
      });
      return {
        response,
        effectiveModel: "muse-spark-open",
        fallback: true,
        fallbackReason,
      };
    }
  }

  // If Meta API is not configured, check if this is a text step that can run on configured Spark Open
  if (canFallbackToSparkOpen && isSparkOpenConfigured()) {
    const response = await callSparkOpenProvider({
      ...params,
      model: "muse-spark-open",
    });
    return {
      response,
      effectiveModel: "muse-spark-open",
      fallback: true,
      fallbackReason: "Meta Model API not configured; routed to Muse Spark Open",
    };
  }

  // Offline / Local dev deterministic mock provider
  const response = await callMockProvider(params);
  return {
    response,
    effectiveModel: params.model,
    fallback: false,
  };
}

/**
 * Executes a model call through the Single Model Gateway and returns both the validated
 * output and the `model_calls` telemetry record (`FR-CL-01`, `NFR-16`, `NFR-18`).
 */
export async function callModelWithTelemetry<TInput, TOutput>(
  call: ModelCall<TInput, TOutput>,
): Promise<ModelCallResult<TOutput>> {
  const startedAt = performance.now();
  const requestedModel = normalizeModelId(call.model);
  const allowFallback =
    call.allowFallback ?? TEXT_FALLBACK_STEPS.has(call.step);

  // Fast path: 7-day trend_analyses cache hit (FR-TR-04) or caller-supplied cache hit
  if (call.cacheHit && call.cachedOutput !== undefined) {
    const data = validateWithSchema(call.cachedOutput, call.schema);
    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
    const telemetry: ModelCallTelemetry = {
      id: randomUUID(),
      shopId: call.shopId ?? null,
      postId: call.postId ?? null,
      step: call.step,
      model: requestedModel,
      requestedModel,
      tokensIn: 0,
      tokensOut: 0,
      images: 0,
      latencyMs,
      costUsd: 0,
      cacheHit: true,
      fallback: false,
      retries: 0,
      provider: "cache",
      createdAt: new Date().toISOString(),
    };
    await emitTelemetry(telemetry);
    return { data, telemetry };
  }

  const expectJson = Boolean(call.schema);
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalImages = 0;
  let retries = 0;
  let lastValidationError: string | undefined;

  // NFR-16: Validate JSON output against schema; retry once on validation failure
  for (let attempt = 0; attempt < 2; attempt++) {
    const dispatched = await dispatchProvider({
      step: call.step,
      model: requestedModel,
      input: call.input,
      systemPrompt: call.systemPrompt,
      expectJson,
      retryValidationError: lastValidationError,
      allowFallback,
    });

    totalTokensIn += dispatched.response.tokensIn;
    totalTokensOut += dispatched.response.tokensOut;
    totalImages += dispatched.response.images;

    try {
      const validated = validateWithSchema(
        dispatched.response.rawOutput,
        call.schema,
      );
      const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
      const costUsd = calculateCallCostUsd({
        model: dispatched.effectiveModel,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        images: totalImages,
        cacheHit: false,
      });

      const telemetry: ModelCallTelemetry = {
        id: randomUUID(),
        shopId: call.shopId ?? null,
        postId: call.postId ?? null,
        step: call.step,
        model: dispatched.effectiveModel,
        requestedModel,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        images: totalImages,
        latencyMs,
        costUsd,
        cacheHit: false,
        fallback: dispatched.fallback,
        fallbackReason: dispatched.fallbackReason,
        retries,
        provider: dispatched.response.provider,
        createdAt: new Date().toISOString(),
      };

      await emitTelemetry(telemetry);
      return { data: validated, telemetry };
    } catch (validationErr) {
      lastValidationError =
        validationErr instanceof Error
          ? validationErr.message
          : String(validationErr);

      if (attempt === 0) {
        retries += 1;
        continue;
      }

      throw new Error(
        `Gateway schema validation failed after retry (step: ${call.step}, model: ${dispatched.effectiveModel}): ${lastValidationError}`,
      );
    }
  }

  throw new Error(`Unreachable gateway state for step: ${call.step}`);
}

/**
 * Primary convenience entry point (`FR-CL-01`).
 * Validates output, logs telemetry to registered listeners, and returns `TOutput`.
 */
export async function callModel<TInput, TOutput>(
  call: ModelCall<TInput, TOutput>,
): Promise<TOutput> {
  const result = await callModelWithTelemetry<TInput, TOutput>(call);
  return result.data;
}
