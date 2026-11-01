import "server-only";
import { NonRetriableError } from "inngest";
import { sendPostReadyEmail } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { Slide } from "@/lib/posts/slides";
import { inngest, type JobEvents } from "./client";
import {
  planDailyCarousel,
  regenerateCaption,
  renderAndVerifySlide,
  type CarouselPlan,
  type TrendAnalysisResult,
} from "./ports";
import { withStep } from "./steps";
import { collectPair } from "./trends";

const MAX_FIDELITY_ATTEMPTS = 2;

// Event post/generate.requested (F-08, FR-CG-06): plan, render, verify, mark ready, notify.
// Every unit is a memoised step, so a retry resumes where it stopped instead of repaying
// for finished model calls. All writes target one post id, which keeps replays idempotent.
export const generatePost = inngest.createFunction(
  {
    id: "post-generate",
    retries: 3,
    concurrency: { limit: 1, key: "event.data.shopId" },
    triggers: [{ event: "post/generate.requested" }],
    onFailure: async ({ event }) => {
      const { postId, shopId } = (event.data.event.data ?? {}) as JobEvents["post/generate.requested"];
      const admin = createAdminClient();
      // Only a post still generating can fail; a ready or approved post is left alone.
      await admin.from("posts").update({ status: "failed" }).eq("id", postId).eq("status", "generating");
      await admin.from("post_steps").insert({
        post_id: postId,
        shop_id: shopId,
        step: "generate",
        status: "failed",
        finished_at: new Date().toISOString(),
        detail: { error: event.data.error?.message ?? "unknown" },
      });
    },
  },
  async ({ event, step }) => {
    const { shopId, postId } = event.data as JobEvents["post/generate.requested"];
    const ctx = { shopId, postId };

    const input = await step.run("load", async () => {
      const admin = createAdminClient();
      const { data: post } = await admin.from("posts").select("id, status").eq("id", postId).single();
      if (!post) throw new NonRetriableError("post not found");
      // Replayed event for a post that already moved on: nothing to do.
      if (post.status !== "generating") return null;

      const [{ data: shop }, { data: rules }, { data: products }] = await Promise.all([
        admin.from("shops").select("*").eq("id", shopId).single(),
        admin.from("style_rules").select("text").eq("shop_id", shopId).order("position"),
        admin
          .from("products")
          .select("id, name, cutout_path")
          .eq("shop_id", shopId)
          .eq("hidden", false)
          .eq("cutout_confirmed", true),
      ]);
      if (!shop) throw new NonRetriableError("shop not found");
      if (!products?.length) throw new NonRetriableError("no confirmed product");

      // Rotate: the product that went longest without a post goes first.
      const { data: recent } = await admin
        .from("posts")
        .select("product_id, post_date")
        .eq("shop_id", shopId)
        .not("product_id", "is", null)
        .order("post_date", { ascending: false })
        .limit(20);
      const lastUsed = new Map<string, string>();
      for (const r of recent ?? []) if (r.product_id && !lastUsed.has(r.product_id)) lastUsed.set(r.product_id, r.post_date);
      const ordered = [...products].sort((a, b) =>
        (lastUsed.get(a.id) ?? "").localeCompare(lastUsed.get(b.id) ?? ""),
      );

      return {
        shop: {
          id: shop.id,
          name: shop.name,
          tone: shop.tone,
          country: shop.country ?? "",
          category: shop.category ?? "",
          ownerId: shop.owner_id,
          contentLanguage: shop.content_language as "en" | "id",
          styleRules: (rules ?? []).map((r) => r.text),
        },
        products: ordered.map((p) => ({ id: p.id, name: p.name, cutoutPath: p.cutout_path })),
      };
    });
    if (!input) return { skipped: "not_generating" };

    const trend = await step.run("pick-trend", () => pickTrend(input.shop));

    const plan = await step.run("plan", () =>
      withStep(ctx, "plan_post", "muse-spark", () =>
        planDailyCarousel({
          shop: input.shop,
          products: input.products,
          trend,
          postId,
        }),
      ),
    ) as CarouselPlan;

    const slides: Slide[] = [];
    for (const s of plan.slides) {
      const slide = await step.run(`slide-${s.order}`, () =>
        withStep(
          ctx,
          `render_slide_${s.order}`,
          "muse-image",
          () => renderSlide(shopId, postId, s),
          (r) => ({ fidelity_score: r.fidelity_score, fidelity_passed: r.fidelity_passed }),
        ),
      );
      slides.push(slide);
    }

    await step.run("finish", async () => {
      const { error } = await createAdminClient()
        .from("posts")
        .update({
          product_id: plan.productId,
          trend_id: trend.id,
          fit_reason: plan.fitReason,
          slides: slides as unknown as Json,
          caption_options: plan.captions as unknown as Json,
          chosen_caption: plan.captions[0]?.text ?? null,
          hashtags: plan.hashtags,
          status: "ready",
        })
        .eq("id", postId)
        .eq("status", "generating");
      if (error) throw new Error(error.message);
    });

    await step.run("notify", async () => {
      const admin = createAdminClient();
      const { data: owner } = await admin.from("users").select("email").eq("id", input.shop.ownerId).single();
      if (!owner?.email) return false;
      return sendPostReadyEmail({ to: owner.email, shopName: input.shop.name, postId });
    });

    return { postId, slides: slides.length };
  },
);

type ShopPick = { country: string; category: string };

async function pickTrend(shop: ShopPick) {
  const admin = createAdminClient();
  const query = () =>
    admin
      .from("trend_analyses")
      .select("*, trends!inner(id, title, score, country, category)")
      .gt("expires_at", new Date().toISOString())
      .eq("trends.country", shop.country)
      .eq("trends.category", shop.category);

  let { data } = await query();
  if (!data?.length) {
    // The morning research has not covered this shop yet, so collect it now.
    await collectPair(shop);
    ({ data } = await query());
  }
  const best = [...(data ?? [])].sort((a, b) => (b.trends.score ?? 0) - (a.trends.score ?? 0))[0];
  if (!best) throw new Error("no trend available");
  return {
    id: best.trends.id,
    title: best.trends.title,
    hook: best.hook ?? "",
    structure: best.structure ?? "",
    visualStyle: best.visual_style ?? "",
    sceneBrief: best.scene_brief ?? "",
    whyItWorks: best.why_it_works ?? "",
    fromVideo: best.from_video,
    model: best.model ?? "",
  } satisfies { id: string; title: string } & TrendAnalysisResult;
}

async function renderSlide(
  shopId: string,
  postId: string,
  s: CarouselPlan["slides"][number],
): Promise<Slide> {
  const admin = createAdminClient();
  // One re-render on a failed fidelity check, then keep the last result as failed.
  let result = await renderAndVerifySlide(s);
  for (let i = 1; i < MAX_FIDELITY_ATTEMPTS && !result.fidelityPassed; i++) {
    result = await renderAndVerifySlide(s);
  }
  const scene_path = `${shopId}/scenes/${postId}-${s.order}.png`;
  const slide_path = `${shopId}/slides/${postId}-${s.order}.png`;
  for (const [path, body] of [
    [scene_path, result.scenePng],
    [slide_path, result.slidePng],
  ] as const) {
    const { error } = await admin.storage
      .from("media")
      .upload(path, body, { contentType: "image/png", upsert: true });
    if (error) throw new Error(`upload ${path}: ${error.message}`);
  }
  return {
    order: s.order,
    text: s.text,
    alt: s.alt,
    scene_path,
    slide_path,
    fidelity_score: result.fidelityScore,
    fidelity_passed: result.fidelityPassed,
  };
}

// Event post/regenerate.requested (F-11): rewrite the caption from owner feedback.
export const regeneratePost = inngest.createFunction(
  {
    id: "post-regenerate",
    retries: 2,
    triggers: [{ event: "post/regenerate.requested" }],
  },
  async ({ event, step }) => {
    const { shopId, postId, revisionId, feedback } = event.data as JobEvents["post/regenerate.requested"];

    await step.run("caption", async () => {
      const admin = createAdminClient();
      const { data: post } = await admin
        .from("posts")
        .select("status, chosen_caption")
        .eq("id", postId)
        .single();
      // The owner may have approved or skipped while this was queued.
      if (post?.status !== "ready") return null;

      const options = await withStep({ postId, shopId }, "regenerate_caption", "muse-spark", () =>
        regenerateCaption({ currentCaption: post.chosen_caption, feedback }),
      );
      await admin.from("post_revisions").update({ output: options as unknown as Json }).eq("id", revisionId);
      const { error } = await admin
        .from("posts")
        .update({ caption_options: options as unknown as Json, chosen_caption: options[0]?.text ?? null })
        .eq("id", postId)
        .eq("status", "ready");
      if (error) throw new Error(error.message);
      return options.length;
    });
  },
);

// Cron posts.daily (Pillar 2): every 15 minutes, start a post for each shop whose local
// notify_time just passed. Each shop becomes its own generate run, so one failing shop
// never affects another (NFR-15).
export const postsDaily = inngest.createFunction(
  { id: "posts-daily", retries: 1, triggers: [{ cron: "*/15 * * * *" }] },
  async ({ step }) => {
    const due = await step.run("create-posts", async () => {
      const admin = createAdminClient();
      const { data: shops } = await admin
        .from("shops")
        .select("id, time_zone, notify_time")
        .not("onboarding_completed_at", "is", null);

      const out: { shopId: string; postId: string }[] = [];
      for (const shop of shops ?? []) {
        const local = localClock(shop.time_zone);
        const [h, m] = shop.notify_time.split(":").map(Number);
        const sinceNotify = local.minutes - (h * 60 + m);
        if (sinceNotify < 0 || sinceNotify >= 15) continue;

        const { data: product } = await admin
          .from("products")
          .select("id")
          .eq("shop_id", shop.id)
          .eq("hidden", false)
          .eq("cutout_confirmed", true)
          .limit(1);
        if (!product?.length) continue;

        const { data: post, error } = await admin
          .from("posts")
          .insert({ shop_id: shop.id, post_date: local.date, status: "generating" })
          .select("id")
          .single();
        // 23505: today's post already exists (Run now or an earlier tick).
        if (error || !post) continue;
        out.push({ shopId: shop.id, postId: post.id });
      }
      return out;
    });

    if (due.length) {
      await step.sendEvent(
        "fan-out",
        due.map((d) => ({
          id: `post/generate.requested:${d.postId}`,
          name: "post/generate.requested",
          data: d,
        })),
      );
    }
    return { started: due.length };
  },
);

function localClock(timeZone: string | null, now = new Date()) {
  const tz = timeZone ?? "UTC";
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(now)
        .map((p) => [p.type, p.value]),
    );
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      minutes: Number(parts.hour) * 60 + Number(parts.minute),
    };
  } catch {
    return { date: now.toISOString().slice(0, 10), minutes: now.getUTCHours() * 60 + now.getUTCMinutes() };
  }
}
