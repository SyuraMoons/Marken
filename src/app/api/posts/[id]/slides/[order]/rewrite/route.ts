import { z } from "zod";
import { getOwnedPost } from "@/lib/api/owner";
import { apiError, conflict, parseJson } from "@/lib/http";
import { SlideEditError, findSlide, rewriteSlideText } from "@/lib/posts/edit-slide";

// Suggest new words for one slide from the owner's instruction (Muse Spark). Nothing is saved until the
// owner runs the edit, so a suggestion can be tried and discarded.
const Body = z.object({ instruction: z.string().trim().min(1).max(300), current: z.string().max(200).default("") });

export async function POST(req: Request, ctx: RouteContext<"/api/posts/[id]/slides/[order]/rewrite">) {
  const { id, order: rawOrder } = await ctx.params;
  const order = Number(rawOrder);
  if (!Number.isInteger(order) || order < 1 || order > 3) return apiError("not_found", 404);
  const guard = await getOwnedPost(id);
  if (!guard.ok) return guard.response;
  if (guard.value.status !== "ready") return conflict("invalid_status", { status: guard.value.status });
  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;

  try {
    findSlide(guard.value, order);
    const out = await rewriteSlideText({ post: guard.value, order, ...parsed.data });
    return Response.json(out);
  } catch (e) {
    if (e instanceof SlideEditError) return apiError(e.code, e.status);
    console.error("slide rewrite failed", e instanceof Error ? e.message : e);
    return apiError("rewrite_failed", 502);
  }
}
