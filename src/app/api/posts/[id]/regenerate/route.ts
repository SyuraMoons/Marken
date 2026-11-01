import { z } from "zod";
import { getOwnedPost, shopDayStartIso } from "@/lib/api/owner";
import { apiError, conflict, parseJson } from "@/lib/http";
import { enqueue } from "@/lib/jobs/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Regenerate the caption from owner feedback (F-11, FR-ED-01): max 5 per post per day.
// Slide image regeneration is P1 (FR-ED-05), so only `caption` is accepted.
const MAX_PER_DAY = 5;

const Body = z.object({
  target: z.literal("caption"),
  feedback: z.string().trim().min(1).max(500),
});

export async function POST(req: Request, ctx: RouteContext<"/api/posts/[id]/regenerate">) {
  const { id } = await ctx.params;
  const guard = await getOwnedPost(id);
  if (!guard.ok) return guard.response;
  const post = guard.value;

  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  const { target, feedback } = parsed.data;

  if (post.status !== "ready") return conflict("invalid_status", { status: post.status });

  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select("time_zone")
    .eq("id", post.shop_id)
    .single();

  const { count } = await supabase
    .from("post_revisions")
    .select("id", { count: "exact", head: true })
    .eq("post_id", post.id)
    .gte("created_at", shopDayStartIso(shop?.time_zone ?? null));
  const used = count ?? 0;
  if (used >= MAX_PER_DAY) return apiError("regenerate_limit", 429, { limit: MAX_PER_DAY });

  const admin = createAdminClient();
  const { data: revision, error } = await admin
    .from("post_revisions")
    .insert({ post_id: post.id, target, feedback })
    .select("id")
    .single();
  if (error || !revision) return apiError("revision_failed", 500);

  const queued = await enqueue(
    "post/regenerate.requested",
    { shopId: post.shop_id, postId: post.id, revisionId: revision.id, target, feedback },
    revision.id,
  );
  if (!queued) {
    // Don't burn one of the owner's 5 daily tries on a request that never ran.
    await admin.from("post_revisions").delete().eq("id", revision.id);
    return apiError("queue_unavailable", 503);
  }

  return Response.json(
    { revisionId: revision.id, remaining: MAX_PER_DAY - used - 1 },
    { status: 202 },
  );
}
