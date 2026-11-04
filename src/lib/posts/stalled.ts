import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// A generate run writes its first post_steps row (pick_trend) seconds after Inngest starts it.
// A post still generating with no step after this long was never picked up by the queue.
export const START_TIMEOUT_MS = 2 * 60_000;

type Post = { id: string; shop_id: string; status: string; created_at: string };

/**
 * True when a generating post never started: no step rows after START_TIMEOUT_MS, and no other
 * post of the shop is generating ahead of it (runs are one at a time per shop, so a queued run
 * can legitimately wait). Screens show "couldn't start" instead of loading, and the generate
 * route frees the post so a retry is not handed the dead one back.
 */
export async function neverStarted(db: SupabaseClient<Database>, post: Post, now = Date.now()) {
  if (post.status !== "generating" || now - Date.parse(post.created_at) < START_TIMEOUT_MS) return false;
  const [steps, ahead] = await Promise.all([
    db.from("post_steps").select("id", { count: "exact", head: true }).eq("post_id", post.id),
    db
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", post.shop_id)
      .eq("status", "generating")
      .lt("created_at", post.created_at),
  ]);
  if (steps.error || ahead.error) return false;
  return (steps.count ?? 0) === 0 && (ahead.count ?? 0) === 0;
}
