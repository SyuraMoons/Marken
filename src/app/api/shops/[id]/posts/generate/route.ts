import { z } from "zod";
import { MAX_BRIEF } from "@/lib/brand-kit";
import { getOwnedShop, shopToday } from "@/lib/api/owner";
import { apiError, conflict } from "@/lib/http";
import { enqueue } from "@/lib/jobs/client";
import { DAILY_POST_LIMIT_CODE, MAX_POSTS_PER_DAY } from "@/lib/posts/limits";
import { allSlidesPassed, asSlides } from "@/lib/posts/slides";
import { neverStarted } from "@/lib/posts/stalled";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Run now: create today's post and hand generation to the job (F-08, FR-CG-06).
// Optional body { productId, brief }: "Generate image post" for one product (SRD A-11) with the owner's brief
// from the create flow (FD-46). No body = Run now, rotation picks the product.
const Body = z.object({ productId: z.uuid().optional(), brief: z.string().trim().max(MAX_BRIEF).optional() });

export async function POST(req: Request, ctx: RouteContext<"/api/shops/[id]/posts/generate">) {
  const { id } = await ctx.params;
  const guard = await getOwnedShop(id);
  if (!guard.ok) return guard.response;
  const shop = guard.value;

  const raw = await req.json().catch(() => ({}));
  const body = Body.safeParse(raw ?? {});
  if (!body.success) return apiError("invalid_body", 400);
  const productId = body.data.productId;
  const brief = body.data.brief || undefined;

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id")
    .eq("shop_id", shop.id)
    .eq("hidden", false)
    .eq("cutout_confirmed", true);
  if (productId) query = query.eq("id", productId);
  const { data: products } = await query.limit(1);
  if (!products?.length) return conflict(productId ? "product_not_ready" : "no_confirmed_product");

  const admin = createAdminClient();
  const postDate = shopToday(shop.time_zone);

  // Double-tap guard: a run still generating for the same request is handed back instead of
  // starting another (Run now matches any generating post, "Make post" the same product).
  let running = admin
    .from("posts")
    .select("*")
    .eq("shop_id", shop.id)
    .eq("post_date", postDate)
    .eq("status", "generating");
  if (productId) running = running.eq("product_id", productId);
  const { data: inFlight } = await running.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (inFlight) {
    if (!(await neverStarted(admin, inFlight))) return Response.json({ post: inFlight, created: false });
    // The queue never ran it, so fail it (freeing the day's slot) and start a fresh one below.
    // If its job turns up later, the job's load step sees the post is no longer generating and stops.
    await admin.from("posts").update({ status: "failed" }).eq("id", inFlight.id).eq("status", "generating");
  }

  // A ready post whose product check failed can never be approved (FR-FD-03), so it gives up
  // its slot. The status guard keeps this from touching a post approved in the meantime.
  const { data: ready } = await admin
    .from("posts")
    .select("id, slides")
    .eq("shop_id", shop.id)
    .eq("post_date", postDate)
    .eq("status", "ready");
  const failed = (ready ?? []).filter((p) => !allSlidesPassed(asSlides(p.slides))).map((p) => p.id);
  if (failed.length) {
    await admin
      .from("posts")
      .update({ status: "skipped", skip_reason: "fidelity_failed" })
      .in("id", failed)
      .eq("status", "ready");
  }

  // Up to MAX_POSTS_PER_DAY live posts per shop per day; the posts_daily_cap trigger enforces it.
  const created = await admin
    .from("posts")
    .insert({ shop_id: shop.id, post_date: postDate, status: "generating", product_id: productId ?? null })
    .select("*")
    .single();
  if (created.error?.code === DAILY_POST_LIMIT_CODE) {
    return conflict("daily_post_limit", { limit: MAX_POSTS_PER_DAY });
  }
  if (created.error) return apiError("post_create_failed", 500);

  const post = created.data;
  const queued = await enqueue(
    "post/generate.requested",
    { shopId: shop.id, postId: post.id, ...(productId ? { productId } : {}), ...(brief ? { brief } : {}) },
    post.id,
  );
  if (!queued) {
    // Nothing will run it, so free the day's slot instead of leaving a post stuck.
    await admin.from("posts").update({ status: "failed" }).eq("id", post.id);
    return apiError("queue_unavailable", 503);
  }

  return Response.json({ post, created: true }, { status: 202 });
}
