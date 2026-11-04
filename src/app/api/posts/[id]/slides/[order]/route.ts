import { getOwnedPost } from "@/lib/api/owner";
import { apiError, conflict, parseJson } from "@/lib/http";
import { SlideEditError, saveSlideEdit } from "@/lib/posts/edit-slide";
import { SlideLayersSchema } from "@/lib/studio/layers";
import { z } from "zod";

// Save an edited slide (SRD A-09): text, fonts, colours and product placement. Code re-renders it, no model
// call besides the fidelity check. Owners cannot write posts directly (FD-08), so this goes through the server.
const Body = z.object({ layers: SlideLayersSchema });

export async function POST(req: Request, ctx: RouteContext<"/api/posts/[id]/slides/[order]">) {
  const { id, order: rawOrder } = await ctx.params;
  const order = Number(rawOrder);
  if (!Number.isInteger(order) || order < 1 || order > 3) return apiError("not_found", 404);
  const guard = await getOwnedPost(id);
  if (!guard.ok) return guard.response;
  if (guard.value.status !== "ready") return conflict("invalid_status", { status: guard.value.status });

  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;

  try {
    const { slide, issues } = await saveSlideEdit({
      post: guard.value,
      order,
      layers: parsed.data.layers,
      revision: { target: "slide" },
    });
    return Response.json({ slide: { order: slide.order, fidelity_passed: slide.fidelity_passed }, issues });
  } catch (e) {
    if (e instanceof SlideEditError) return apiError(e.code, e.status);
    console.error("slide edit failed", e instanceof Error ? e.message : e);
    return apiError("slide_edit_failed", 500);
  }
}
