import "server-only";
import { createHash } from "node:crypto";
import { NonRetriableError } from "inngest";
import { sendPostReadyEmail } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { Slide } from "@/lib/posts/slides";
import { isFontId, type BrandStyle } from "@/lib/studio/layers";
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

// A post still generating after this long is dead: free the day's slot so Run now works.
const STUCK_AFTER_MINUTES = 15;
// FR-CG-02: a trend the shop already posted is not suggested again within this many posts.
const TREND_MEMORY = 7;

// Stable UUID from a string, so a replayed step upserts the same row instead of adding one.
function deterministicUuid(seed: string) {
  const h = createHash("sha256").update(seed).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const hashtag = (h: string) => {
  const clean = h.trim().replace(/^#+/, "").replace(/\s+/g, "");
  return clean ? `#${clean}` : "";
};

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
    const { shopId, postId, productId } = event.data as JobEvents["post/generate.requested"];
    const ctx = { shopId, postId };

    const input = await step.run("load", async () => {
      const admin = createAdminClient();
      const { data: post } = await admin.from("posts").select("id, status").eq("id", postId).single();
      if (!post) throw new NonRetriableError("post not found");
      // Replayed event for a post that already moved on: nothing to do.
      if (post.status !== "generating") return null;

      const [{ data: shop }, { data: rules }, { data: products }, { data: kit }] = await Promise.all([
        admin.from("shops").select("*").eq("id", shopId).single(),
        admin.from("style_rules").select("text").eq("shop_id", shopId).order("position"),
        admin
          .from("products")
          .select("id, name, cutout_path")
          .eq("shop_id", shopId)
          .eq("hidden", false)
          .eq("cutout_confirmed", true),
        admin.from("brand_kits").select("colors, heading_font, body_font, design_guidance, photo_style").eq("shop_id", shopId).maybeSingle(),
      ]);
      if (!shop) throw new NonRetriableError("shop not found");
      if (!products?.length) throw new NonRetriableError("no confirmed product");
      // "Make a post with this product" (A-11): only that product is offered to the planner. If it was hidden or
      // unconfirmed since the tap, fail the post instead of quietly posting a different product.
      const eligible = productId ? products.filter((p) => p.id === productId) : products;
      if (!eligible.length) throw new NonRetriableError("requested product is no longer available");

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
      const ordered = [...eligible].sort((a, b) =>
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
        // Brand kit colours and fonts style the text layers on every slide (SRD A-09).
        brand: {
          colors: Array.isArray(kit?.colors) ? kit.colors.filter((c): c is string => typeof c === "string") : [],
          headingFont: isFontId(kit?.heading_font) ? kit.heading_font : null,
          bodyFont: isFontId(kit?.body_font) ? kit.body_font : null,
        } satisfies BrandStyle,
        // Guidance and photo style go into every scene brief like tone and rules (SRD A-09).
        brandNote: [kit?.design_guidance, kit?.photo_style].map((x) => x?.trim()).filter(Boolean).join(" "),
      };
    });
    if (!input) return { skipped: "not_generating" };

    const trend = await step.run("pick-trend", () => pickTrend(input.shop, postId));

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

    const chosenProduct =
      input.products.find((p) => p.id === plan.productId) ?? input.products[0];

    const slides: Slide[] = [];
    for (const s of plan.slides) {
      const slide = await step.run(`slide-${s.order}`, () =>
        withStep(
          ctx,
          `render_slide_${s.order}`,
          "muse-image",
          () =>
            renderSlide(
              shopId,
              postId,
              input.brandNote ? { ...s, sceneBrief: `${s.sceneBrief} Brand style: ${input.brandNote}` } : s,
              chosenProduct?.cutoutPath,
              input.shop.tone ?? undefined,
              input.shop.styleRules,
              input.shop.contentLanguage,
              input.brand,
            ),
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
          hashtags: plan.hashtags.map(hashtag).filter(Boolean),
          status: "ready",
        })
        .eq("id", postId)
        .eq("status", "generating");
      if (error) throw new Error(error.message);
    });

    // The post is already ready here, so a mail failure must not fail the run (F-13 is
    // the first feature cut): log it as a skipped step and move on.
    await step.run("notify", async () => {
      const admin = createAdminClient();
      const { data: owner } = await admin.from("users").select("email").eq("id", input.shop.ownerId).single();
      if (!owner?.email) return false;
      try {
        return await sendPostReadyEmail({ to: owner.email, shopName: input.shop.name, postId });
      } catch (error) {
        await admin.from("post_steps").insert({
          post_id: postId,
          shop_id: shopId,
          step: "notify",
          status: "skipped",
          finished_at: new Date().toISOString(),
          detail: { error: error instanceof Error ? error.message : String(error) },
        });
        return false;
      }
    });

    return { postId, slides: slides.length };
  },
);

type ShopPick = { id: string; country: string; category: string };

async function pickTrend(shop: ShopPick, postId: string) {
  const admin = createAdminClient();
  const query = () =>
    admin
      .from("trend_analyses")
      .select("*, trends!inner(id, title, score, country, category)")
      .gt("expires_at", new Date().toISOString())
      .eq("trends.country", shop.country)
      .eq("trends.category", shop.category);

  let { data } = await query();
  let cacheHit = true;
  if (!data?.length) {
    // The morning research has not covered this shop yet, so collect it now.
    cacheHit = false;
    await collectPair(shop);
    ({ data } = await query());
  }

  // FR-CG-02: prefer a trend this shop has not used in its last posts, but repeat one
  // rather than fail when every analysed trend was already used.
  const { data: recent } = await admin
    .from("posts")
    .select("trend_id")
    .eq("shop_id", shop.id)
    .neq("id", postId)
    .not("trend_id", "is", null)
    .order("post_date", { ascending: false })
    .limit(TREND_MEMORY);
  const used = new Set((recent ?? []).map((r) => r.trend_id));
  const fresh = (data ?? []).filter((a) => !used.has(a.trends.id));
  const pool = fresh.length ? fresh : (data ?? []);

  const best = [...pool].sort((a, b) => (b.trends.score ?? 0) - (a.trends.score ?? 0))[0];
  if (!best) throw new Error("no trend available");

  // FR-TR-04 / FR-CL-02: an analysis served from the 7-day cache is logged at zero cost,
  // so the Activity Panel can show the cache share. A replayed step may log it twice, so
  // the id is derived from the post to keep it to one row.
  if (cacheHit) {
    await admin.from("model_calls").upsert({
      id: deterministicUuid(`${postId}:analyse_trend`),
      shop_id: shop.id,
      post_id: postId,
      step: "analyse_trend",
      model: best.model ?? "muse-spark",
      provider: "cache",
      cache_hit: true,
      cost_usd: 0,
    });
  }
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
  cutoutPath?: string | null,
  shopTone?: string,
  styleRules?: string[],
  contentLanguage?: "en" | "id",
  brand?: BrandStyle,
): Promise<Slide> {
  const admin = createAdminClient();
  // The studio rebuilds a failed slide once (FR-FD-01), then flags it. Retrying here too
  // would multiply paid image calls past the USD 0.10 per carousel target (NFR-06).
  const result = await renderAndVerifySlide({
    ...s,
    cutoutPath,
    shopId,
    postId,
    shopTone,
    styleRules,
    contentLanguage,
    brand,
  });
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
    layers: result.layers,
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

      const { data: shop } = await admin
        .from("shops")
        .select("tone, content_language")
        .eq("id", shopId)
        .single();

      const options = await withStep({ postId, shopId }, "regenerate_caption", "muse-spark", () =>
        regenerateCaption({
          currentCaption: post.chosen_caption,
          feedback,
          shopId,
          postId,
          shop: {
            tone: shop?.tone,
            contentLanguage: (shop?.content_language as "en" | "id") ?? "en",
          },
        }),
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

// Cron posts.sweep (NFR-15, NFR-17): a generate run that died without its onFailure hook
// (deploy, crash, lost event) would hold the day's slot forever. Fail it visibly so the
// owner can tap Run now again and the Activity Panel shows where it stopped.
export const postsSweep = inngest.createFunction(
  { id: "posts-sweep", retries: 1, triggers: [{ cron: "*/10 * * * *" }] },
  async ({ step }) => {
    return step.run("fail-stuck", async () => {
      const admin = createAdminClient();
      const cutoff = new Date(Date.now() - STUCK_AFTER_MINUTES * 60_000).toISOString();
      const { data, error } = await admin
        .from("posts")
        .update({ status: "failed" })
        .eq("status", "generating")
        .lt("created_at", cutoff)
        .select("id, shop_id");
      if (error) throw new Error(error.message);
      if (data?.length) {
        await admin.from("post_steps").insert(
          data.map((p) => ({
            post_id: p.id,
            shop_id: p.shop_id,
            step: "generate",
            status: "failed" as const,
            finished_at: new Date().toISOString(),
            detail: { error: `no progress after ${STUCK_AFTER_MINUTES} minutes` },
          })),
        );
      }
      return { failed: data?.length ?? 0 };
    });
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
