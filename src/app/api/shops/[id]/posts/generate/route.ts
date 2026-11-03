import { z } from "zod";
import { MAX_BRIEF } from "@/lib/brand-kit";
import { getOwnedShop, shopToday } from "@/lib/api/owner";
import { apiError, conflict } from "@/lib/http";
import { enqueue } from "@/lib/jobs/client";
import { allSlidesPassed, asSlides } from "@/lib/posts/slides";
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

  const insertPost = () =>
    admin
      .from("posts")
      .insert({ shop_id: shop.id, post_date: postDate, status: "generating", product_id: productId ?? null })
      .select("*")
      .single();

  let created = await insertPost();

  if (created.error?.code === "23505") {
    // One live post per shop per day: a repeat tap returns today's post.
    const { data: live } = await admin
      .from("posts")
      .select("*")
      .eq("shop_id", shop.id)
      .eq("post_date", postDate)
      .not("status", "in", "(skipped,failed)")
      .maybeSingle();

    // A ready post whose product check failed can never be approved (FR-FD-03), so the
    // retry button must replace it instead of handing the same post back. The status
    // guard keeps this from touching a post the owner approved in the meantime.
    // The owner asked for a specific product (A-11): a ready post that is not approved yet gives way to it.
    // An approved or published post is never replaced.
    if (productId && live && live.status !== "generating" && live.status !== "ready") {
      return conflict("today_post_locked", { status: live.status });
    }
    const failedFidelity = live?.status === "ready" && !allSlidesPassed(asSlides(live.slides));
    if (live?.status === "ready" && (productId || failedFidelity)) {
      const { data: replaced } = await admin
        .from("posts")
        .update({ status: "skipped", skip_reason: productId ? "replaced_by_owner" : "fidelity_failed" })
        .eq("id", live.id)
        .eq("status", "ready")
        .select("id")
        .maybeSingle();
      if (replaced) created = await insertPost();
    }

    if (created.error) {
      if (live && created.error.code === "23505") return Response.json({ post: live, created: false });
      return apiError("post_create_failed", 500);
    }
  } else if (created.error) {
    return apiError("post_create_failed", 500);
  }

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
