import "server-only";
import type { ModelCallTelemetry } from "@/lib/gateway";
import { createAdminClient } from "./admin";

// Persists gateway telemetry to model_calls (FR-CL-01, FR-AP-01). The gateway swallows
// logger errors, so failures are logged here to stay visible.
export async function writeModelCall(t: ModelCallTelemetry): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("model_calls")
      .upsert({
        id: t.id,
        shop_id: t.shopId,
        post_id: t.postId,
        step: t.step,
        model: t.model,
        requested_model: t.requestedModel,
        tokens_in: t.tokensIn,
        tokens_out: t.tokensOut,
        images: t.images,
        latency_ms: Math.round(t.latencyMs),
        cost_usd: t.costUsd,
        cache_hit: t.cacheHit,
        fallback: t.fallback,
        fallback_reason: t.fallbackReason ?? null,
        retries: t.retries,
        provider: t.provider,
        created_at: t.createdAt,
      });
    if (error) console.error("[model_calls] insert failed:", error.message);
  } catch (err) {
    console.error("[model_calls] writer error:", err);
  }
}
