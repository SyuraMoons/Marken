import { z } from "zod";
import { getOwnedPost } from "@/lib/api/owner";
import { apiError, conflict, parseJson } from "@/lib/http";
import { enqueue } from "@/lib/jobs/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Approve and enqueue publish (F-10, F-12). The database trigger also enforces the gate
// (FR-TD-02): only a `ready` post becomes `approved`, only `approved` can publish.

const Body = z.object({
  caption: z.string().trim().min(1).max(2200).optional(),
});

// A post is only publishable when it has slides and every one passed the product check (FR-FD-01).
function allSlidesPassed(slides: unknown) {
  return (
    Array.isArray(slides) &&
    slides.length > 0 &&
    slides.every((s) => (s as { fidelity_passed?: unknown } | null)?.fidelity_passed === true)
  );
}

export async function POST(req: Request, ctx: RouteContext<"/api/posts/[id]/approve">) {
  const { id } = await ctx.params;
  const guard = await getOwnedPost(id);
  if (!guard.ok) return guard.response;
  let post = guard.value;

  const parsed = await parseJson(req, Body, { allowEmpty: true });
  if ("response" in parsed) return parsed.response;
  const { caption } = parsed.data;

  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select("ig_account_id")
    .eq("id", post.shop_id)
    .single();
  const canPublish = Boolean(shop?.ig_account_id);

  if (post.status === "publishing" || post.status === "published") {
    return Response.json({ post, publish: post.status });
  }

  // A failed publish retries through Approve; a post that never got approved cannot (trigger rule).
  if (post.status === "failed" && !post.approved_at) {
    return conflict("invalid_status", { status: post.status });
  }
  if ((post.status === "ready" || post.status === "failed") && !allSlidesPassed(post.slides)) {
    return conflict("fidelity_failed");
  }

  if (post.status === "ready" || post.status === "failed") {
    const chosen = caption ?? post.chosen_caption;
    if (!chosen) return apiError("caption_required", 400);

    const admin = createAdminClient();
    const { data: updated } = await admin
      .from("posts")
      .update({ status: "approved", chosen_caption: chosen })
      .eq("id", post.id)
      .eq("status", post.status)
      .select("*")
      .maybeSingle();
    if (!updated) {
      // Lost a race (skipped or approved in parallel): report the current state.
      const { data: current } = await admin.from("posts").select("status").eq("id", post.id).single();
      return conflict("invalid_status", { status: current?.status });
    }
    post = updated;
  } else if (post.status !== "approved") {
    return conflict("invalid_status", { status: post.status });
  }

  // `approved` here is either just approved or a repeat tap after a failed send.
  if (!canPublish) return Response.json({ post, publish: "manual" });

  const queued = await enqueue(
    "post/publish.requested",
    { shopId: post.shop_id, postId: post.id },
    post.id,
  );
  // The post stays approved, so tapping Approve again retries the send.
  if (!queued) return apiError("queue_unavailable", 503, { status: "approved" });

  return Response.json({ post, publish: "queued" });
}
