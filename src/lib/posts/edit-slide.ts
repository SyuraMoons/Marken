import "server-only";
import { z } from "zod";
import { shopDayStartIso, type Post } from "@/lib/api/owner";
import { checkStyleRules } from "@/lib/agents/rules";
import { callModelWithTelemetry } from "@/lib/gateway";
import { asSlides, type Slide } from "@/lib/posts/slides";
import { generateSlideScene, verifySlideFidelity } from "@/lib/studio";
import { normalizeLayers, type SlideLayers } from "@/lib/studio/layers";
import { renderLayeredSlide } from "@/lib/studio/render";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

// Owner edits to a ready post's slides (SRD v2.1 A-09). Every edit re-renders from layers and re-runs the
// fidelity check, so the "Real product" badge only ever shows for what the owner will actually publish.

/** AI edits (rewrite, new background) per post per day; manual edits are free. */
export const MAX_AI_EDITS_PER_DAY = 10;

export class SlideEditError extends Error {
  constructor(
    public code: "slide_not_found" | "slide_not_editable" | "product_unavailable" | "conflict" | "ai_edit_limit",
    public status: number,
  ) {
    super(code);
  }
}

async function download(path: string) {
  const { data, error } = await createAdminClient().storage.from("media").download(path);
  if (error || !data) throw new Error(`Could not load ${path}: ${error?.message ?? "empty"}`);
  return Buffer.from(await data.arrayBuffer());
}

async function upload(path: string, body: Buffer) {
  const { error } = await createAdminClient().storage.from("media").upload(path, body, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`Could not save ${path}: ${error.message}`);
}

export function findSlide(post: Post, order: number) {
  const slides = asSlides(post.slides);
  const slide = slides.find((s) => s.order === order);
  if (!slide) throw new SlideEditError("slide_not_found", 404);
  if (!slide.layers) throw new SlideEditError("slide_not_editable", 409);
  return { slides, slide, layers: slide.layers };
}

async function shopRules(shopId: string) {
  const admin = createAdminClient();
  const [{ data: shop }, { data: rules }] = await Promise.all([
    admin.from("shops").select("tone, content_language").eq("id", shopId).single(),
    admin.from("style_rules").select("text").eq("shop_id", shopId).order("position"),
  ]);
  return {
    tone: shop?.tone ?? undefined,
    contentLanguage: (shop?.content_language === "id" ? "id" : "en") as "en" | "id",
    styleRules: (rules ?? []).map((r) => r.text),
  };
}

async function countAiEdits(post: Post) {
  const admin = createAdminClient();
  const { data: shop } = await admin.from("shops").select("time_zone").eq("id", post.shop_id).single();
  const { count } = await admin
    .from("post_revisions")
    .select("id", { count: "exact", head: true })
    .eq("post_id", post.id)
    .eq("target", "slide_ai")
    .gte("created_at", shopDayStartIso(shop?.time_zone ?? null));
  return count ?? 0;
}

export async function assertAiEditAllowed(post: Post) {
  if ((await countAiEdits(post)) >= MAX_AI_EDITS_PER_DAY) throw new SlideEditError("ai_edit_limit", 429);
}

/**
 * Re-renders one slide from `layers` (and a new scene when given), verifies it and saves it.
 * The product pixels come from the confirmed cutout only (FR-CG-09).
 */
export async function saveSlideEdit(opts: {
  post: Post;
  order: number;
  layers: SlideLayers;
  /** A freshly generated scene PNG; otherwise the stored scene is reused. */
  newScene?: Buffer;
  revision: { target: "slide" | "slide_ai"; feedback?: string };
}) {
  const { post, order } = opts;
  const { slide } = findSlide(post, order);
  if (!post.product_id) throw new SlideEditError("product_unavailable", 409);
  const admin = createAdminClient();
  const { data: product } = await admin.from("products").select("cutout_path").eq("id", post.product_id).maybeSingle();
  if (!product?.cutout_path) throw new SlideEditError("product_unavailable", 409);

  const layers = normalizeLayers(opts.layers);
  const [scene, cutout, rules] = await Promise.all([
    opts.newScene ?? download(slide.scene_path),
    download(product.cutout_path),
    shopRules(post.shop_id),
  ]);
  const rendered = await renderLayeredSlide({ scene, cutout, layers });

  // Pixel check on the product region, plus spelling and style rules on the words the owner chose.
  const text = layers.text.map((t) => t.text.trim()).filter(Boolean).join(" ");
  const fidelity = await verifySlideFidelity({
    slide: rendered.slideBuffer,
    scaledCutout: rendered.scaledCutoutBuffer,
    placedBox: rendered.placedBox,
    slideText: text,
    shopTone: rules.tone,
    styleRules: rules.styleRules,
    contentLanguage: rules.contentLanguage,
    shopId: post.shop_id,
    postId: post.id,
  });

  // New file names bust the signed-URL and image caches.
  const stamp = Date.now().toString(36);
  const slide_path = `${post.shop_id}/slides/${post.id}-${order}-${stamp}.png`;
  await upload(slide_path, rendered.slideBuffer);
  let scene_path = slide.scene_path;
  if (opts.newScene) {
    scene_path = `${post.shop_id}/scenes/${post.id}-${order}-${stamp}.png`;
    await upload(scene_path, opts.newScene);
  }

  // Re-read right before writing so a concurrent edit to another slide is not overwritten.
  const { data: fresh } = await admin.from("posts").select("slides, status").eq("id", post.id).single();
  if (!fresh || fresh.status !== "ready") throw new SlideEditError("conflict", 409);
  const updated: Slide = {
    ...slide,
    text: layers.text.find((t) => t.role !== "body")?.text ?? text,
    alt: text || slide.alt,
    slide_path,
    scene_path,
    fidelity_score: fidelity.fidelityScore,
    fidelity_passed: fidelity.fidelityPassed,
    layers: { ...layers, sceneBrief: layers.sceneBrief },
  };
  const slides = asSlides(fresh.slides).map((s) => (s.order === order ? updated : s));
  const { error } = await admin.from("posts").update({ slides: slides as unknown as Json }).eq("id", post.id).eq("status", "ready");
  if (error) throw new Error(error.message);

  await admin.from("post_revisions").insert({
    post_id: post.id,
    target: opts.revision.target,
    feedback: opts.revision.feedback ?? null,
    output: { order, text } as unknown as Json,
  });
  // The replaced files are no longer referenced.
  const stale = [slide.slide_path, opts.newScene ? slide.scene_path : ""].filter(Boolean);
  if (stale.length) await admin.storage.from("media").remove(stale).catch(() => null);

  return { slide: updated, issues: fidelity.issues };
}

const RewriteSchema = z.object({ text: z.string().trim().min(1).max(120) });

/** Muse Spark rewrites one slide's words from the owner's instruction; the result is a suggestion, nothing is saved. */
export async function rewriteSlideText(opts: { post: Post; order: number; instruction: string; current: string }) {
  await assertAiEditAllowed(opts.post);
  const rules = await shopRules(opts.post.shop_id);
  const system = [
    "You are MARKEN's slide copy editor. Rewrite the text on ONE Instagram carousel slide from the owner's instruction.",
    "Keep it short: at most 8 words. Never invent prices, discounts, claims or facts about the product.",
    `Language: ${rules.contentLanguage === "id" ? "Bahasa Indonesia" : "English"}.`,
    rules.tone ? `Shop tone: ${rules.tone}.` : "",
    rules.styleRules.length ? `Shop style rules:\n${rules.styleRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}` : "",
    'Respond with JSON only: { "text": string }.',
  ]
    .filter(Boolean)
    .join("\n\n");
  const { data } = await callModelWithTelemetry<string, z.infer<typeof RewriteSchema>>({
    step: "rewrite_slide_text",
    model: "muse-spark",
    shopId: opts.post.shop_id,
    postId: opts.post.id,
    systemPrompt: system,
    schema: RewriteSchema,
    input: JSON.stringify({ currentText: opts.current, instruction: opts.instruction }),
  });
  // Same rule check as captions (FR-SP-06): a suggestion that breaks a rule is not offered.
  const check = await checkStyleRules({
    texts: [data.text],
    shopTone: rules.tone,
    styleRules: rules.styleRules,
    contentLanguage: rules.contentLanguage,
    shopId: opts.post.shop_id,
    postId: opts.post.id,
  });
  await createAdminClient().from("post_revisions").insert({
    post_id: opts.post.id,
    target: "slide_ai",
    feedback: opts.instruction,
    output: { order: opts.order, suggestion: data.text, rulesPassed: check.passed } as unknown as Json,
  });
  return { text: data.text, rulesPassed: check.passed, violations: check.violations };
}

/** New scene from Muse Image (product area kept empty, no text), then the same layers on top. */
export async function newBackground(opts: { post: Post; order: number; prompt?: string }) {
  await assertAiEditAllowed(opts.post);
  const { layers } = findSlide(opts.post, opts.order);
  const brief = opts.prompt?.trim() ? `${layers.sceneBrief}. Owner change: ${opts.prompt.trim()}` : layers.sceneBrief;
  const scene = await generateSlideScene({
    sceneBrief: brief,
    slideText: "",
    reservedBox: layers.product.box,
    step: "regenerate_image",
    shopId: opts.post.shop_id,
    postId: opts.post.id,
  });
  return saveSlideEdit({
    post: opts.post,
    order: opts.order,
    // The owner's note becomes part of the brief so the next "New background" keeps it.
    layers: { ...layers, sceneBrief: opts.prompt?.trim() ? brief : layers.sceneBrief },
    newScene: scene.sceneBuffer,
    revision: { target: "slide_ai", feedback: opts.prompt },
  });
}
