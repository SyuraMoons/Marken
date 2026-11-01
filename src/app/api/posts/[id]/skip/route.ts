import { z } from "zod";
import { getOwnedPost } from "@/lib/api/owner";
import { conflict, parseJson } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

// Skip with optional reason (FR-TD-03).
const Body = z.object({
  reason: z.string().trim().min(1).max(200).optional(),
  note: z.string().trim().min(1).max(200).optional(),
});

export async function POST(req: Request, ctx: RouteContext<"/api/posts/[id]/skip">) {
  const { id } = await ctx.params;
  const guard = await getOwnedPost(id);
  if (!guard.ok) return guard.response;
  const post = guard.value;

  const parsed = await parseJson(req, Body, { allowEmpty: true });
  if ("response" in parsed) return parsed.response;
  const { reason, note } = parsed.data;
  const skipReason = [reason, note].filter(Boolean).join(": ") || null;

  if (post.status === "skipped") return Response.json({ post });
  if (post.status !== "ready") return conflict("invalid_status", { status: post.status });

  const admin = createAdminClient();
  const { data: updated } = await admin
    .from("posts")
    .update({ status: "skipped", skip_reason: skipReason })
    .eq("id", post.id)
    .eq("status", "ready")
    .select("*")
    .maybeSingle();
  if (!updated) {
    const { data: current } = await admin.from("posts").select("status").eq("id", post.id).single();
    return conflict("invalid_status", { status: current?.status });
  }
  return Response.json({ post: updated });
}
