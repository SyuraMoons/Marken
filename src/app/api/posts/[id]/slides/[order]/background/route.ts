import { z } from "zod";
import { getOwnedPost } from "@/lib/api/owner";
import { apiError, conflict, parseJson } from "@/lib/http";
import { SlideEditError, newBackground } from "@/lib/posts/edit-slide";

// New background for one slide (Muse Image, about USD 0.01). The scene never contains the product or text:
// code places the original product pixels and the text on top, then the fidelity check runs again.
const Body = z.object({ prompt: z.string().trim().max(300).optional() });

export const maxDuration = 120;

export async function POST(req: Request, ctx: RouteContext<"/api/posts/[id]/slides/[order]/background">) {
  const { id, order: rawOrder } = await ctx.params;
  const order = Number(rawOrder);
  if (!Number.isInteger(order) || order < 1 || order > 3) return apiError("not_found", 404);
  const guard = await getOwnedPost(id);
  if (!guard.ok) return guard.response;
  if (guard.value.status !== "ready") return conflict("invalid_status", { status: guard.value.status });
  const parsed = await parseJson(req, Body, { allowEmpty: true });
  if ("response" in parsed) return parsed.response;

  try {
    const { slide } = await newBackground({ post: guard.value, order, prompt: parsed.data.prompt });
    return Response.json({ slide: { order: slide.order, fidelity_passed: slide.fidelity_passed } });
  } catch (e) {
    if (e instanceof SlideEditError) return apiError(e.code, e.status);
    console.error("new background failed", e instanceof Error ? e.message : e);
    return apiError("background_failed", 502);
  }
}
