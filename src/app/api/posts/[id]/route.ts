import { getOwnedPost } from "@/lib/api/owner";
import { apiError, conflict } from "@/lib/http";
import { canDeletePost } from "@/lib/posts/deletable";
import { createAdminClient } from "@/lib/supabase/admin";

// Delete a post and its images. Row deletes cascade (steps, revisions), model_calls keep their cost rows.
// Which statuses are allowed is decided by canDeletePost (src/lib/posts/deletable.ts).
// Files are named `${postId}-${order}[-${stamp}].png|jpg` under these folders (see jobs/posts.ts, edit-slide.ts, jobs/publish.ts).
const FOLDERS = ["slides", "scenes", "publish"] as const;

export async function DELETE(_req: Request, ctx: RouteContext<"/api/posts/[id]">) {
  const { id } = await ctx.params;
  const guard = await getOwnedPost(id);
  if (!guard.ok) return guard.response;
  const post = guard.value;

  const admin = createAdminClient();
  const { data: shop } = await admin.from("shops").select("ig_account_id").eq("id", post.shop_id).single();
  const igConnected = Boolean(shop?.ig_account_id);
  if (!canDeletePost(post, igConnected)) return conflict("invalid_status", { status: post.status });

  // Files first: if one fails the row stays and the owner can retry, so no file is orphaned.
  const bucket = admin.storage.from("media");
  for (const folder of FOLDERS) {
    const prefix = `${post.shop_id}/${folder}`;
    const { data: files, error } = await bucket.list(prefix, { limit: 100, search: post.id });
    if (error) return apiError("media_delete_failed", 500);
    const mine = (files ?? []).filter((f) => f.name.startsWith(`${post.id}-`)).map((f) => `${prefix}/${f.name}`);
    if (!mine.length) continue;
    const removed = await bucket.remove(mine);
    if (removed.error) return apiError("media_delete_failed", 500);
  }

  // The status guard keeps this from deleting a post whose status moved while the files were being removed.
  const { data: deleted, error } = await admin
    .from("posts")
    .delete()
    .eq("id", post.id)
    .eq("status", post.status)
    .select("id")
    .maybeSingle();
  if (error) return apiError("post_delete_failed", 500);
  if (!deleted) return conflict("invalid_status");
  return Response.json({ deleted: true });
}
