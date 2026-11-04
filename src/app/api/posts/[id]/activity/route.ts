import { getOwnedPost } from "@/lib/api/owner";
import { apiError } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

// Live Agent Activity Panel data (F-24, FR-AP-01, FR-CL-02, NFR-17). Read through the
// owner's RLS client, so rows from another shop can never appear.
export async function GET(_req: Request, ctx: RouteContext<"/api/posts/[id]/activity">) {
  const { id } = await ctx.params;
  const guard = await getOwnedPost(id);
  if (!guard.ok) return guard.response;
  const post = guard.value;

  const supabase = await createClient();
  const [steps, calls] = await Promise.all([
    supabase
      .from("post_steps")
      .select("id, step, status, model, started_at, finished_at, detail")
      .eq("post_id", post.id)
      .order("started_at"),
    supabase
      .from("model_calls")
      .select(
        "id, step, model, requested_model, tokens_in, tokens_out, images, latency_ms, cost_usd, cache_hit, fallback, fallback_reason, retries, created_at",
      )
      .eq("post_id", post.id)
      .order("created_at"),
  ]);
  if (steps.error || calls.error) return apiError("activity_failed", 500);

  const modelCalls = calls.data ?? [];
  const cacheHits = modelCalls.filter((c) => c.cache_hit).length;
  const totalCost = modelCalls.reduce((sum, c) => sum + Number(c.cost_usd), 0);
  const cachedCost = modelCalls
    .filter((c) => c.cache_hit)
    .reduce((sum, c) => sum + Number(c.cost_usd), 0);

  const slides = Array.isArray(post.slides) ? post.slides : [];
  const fidelity = slides.map((slide) => {
    const s = (slide ?? {}) as Record<string, unknown>;
    return {
      order: s.order ?? null,
      fidelity_score: s.fidelity_score ?? null,
      fidelity_passed: s.fidelity_passed ?? null,
    };
  });

  return Response.json(
    {
      post: { id: post.id, status: post.status },
      steps: steps.data ?? [],
      modelCalls,
      fidelity,
      // True only when the post has slides and every one passed (FR-FD-03).
      realProduct: fidelity.length > 0 && fidelity.every((f) => f.fidelity_passed === true),
      totals: {
        calls: modelCalls.length,
        costUsd: Number(totalCost.toFixed(6)),
        cachedCostUsd: Number(cachedCost.toFixed(6)),
        cacheShare: modelCalls.length ? cacheHits / modelCalls.length : 0,
        fallbacks: modelCalls.filter((c) => c.fallback).length,
        latencyMs: modelCalls.reduce((sum, c) => sum + c.latency_ms, 0),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
