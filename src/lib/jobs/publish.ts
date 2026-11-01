import "server-only";
import { NonRetriableError } from "inngest";
import sharp from "sharp";
import {
  InstagramError,
  buildCaption,
  containerStatus,
  createCarouselContainer,
  createImageContainer,
  disconnectShop,
  findRecentMedia,
  getPermalink,
  getValidToken,
  publishContainer,
  refreshShopToken,
} from "@/lib/instagram";
import { allSlidesPassed, asSlides } from "@/lib/posts/slides";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest, type JobEvents } from "./client";
import { withStep } from "./steps";

const POLL_ATTEMPTS = 12; // × 10 s = 2 minutes per container group
const SIGNED_URL_SECONDS = 3600;

// Instagram errors that will fail the same way again stop the retries (FR-PB-04):
// an auth error also disconnects the shop so Approve falls back to download + copy.
async function guard<T>(shopId: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof InstagramError) {
      if (e.auth) {
        await disconnectShop(shopId);
        throw new NonRetriableError(`instagram auth: ${e.message}`);
      }
      if (!e.retriable) throw new NonRetriableError(`instagram: ${e.message}`);
    }
    throw e;
  }
}

// Event post/publish.requested (F-12, FR-PB-01..03): upload the verified slides as JPEG,
// build the carousel, publish it, store media id + permalink. 3 retries. Only an
// `approved` post can start (FR-TD-02); the claim below is the single gate.
export const publishPost = inngest.createFunction(
  {
    id: "post-publish",
    retries: 3,
    concurrency: { limit: 1, key: "event.data.shopId" },
    triggers: [{ event: "post/publish.requested" }],
    onFailure: async ({ event }) => {
      const { postId, shopId } = (event.data.event.data ?? {}) as JobEvents["post/publish.requested"];
      const admin = createAdminClient();
      // Only a post this job moved to publishing can fail; an approved one stays retryable.
      await admin.from("posts").update({ status: "failed" }).eq("id", postId).eq("status", "publishing");
      await admin.from("post_steps").insert({
        post_id: postId,
        shop_id: shopId,
        step: "publish",
        status: "failed",
        finished_at: new Date().toISOString(),
        detail: { error: event.data.error?.message ?? "unknown" },
      });
    },
  },
  async ({ event, step }) => {
    const { shopId, postId } = event.data as JobEvents["post/publish.requested"];
    const ctx = { shopId, postId };

    const input = await step.run("claim", async () => {
      const admin = createAdminClient();
      const { data: post } = await admin
        .from("posts")
        .select("status, slides, chosen_caption, hashtags, ig_media_id")
        .eq("id", postId)
        .eq("shop_id", shopId)
        .single();
      if (!post) throw new NonRetriableError("post not found");
      // A replayed event, or a post skipped/failed since: nothing to do. `publishing` is accepted
      // so a retry whose claim committed but whose result was lost still resumes (runs for one
      // shop are serialised, so it is never a second live run).
      if (post.status !== "approved" && post.status !== "publishing") return null;

      const slides = asSlides(post.slides).sort((a, b) => a.order - b.order);
      // The approve route checks this too; re-check so a stale event cannot publish.
      if (!allSlidesPassed(slides)) throw new NonRetriableError("slides did not pass the product check");
      if (!post.chosen_caption) throw new NonRetriableError("no caption");

      const { data: shop } = await admin.from("shops").select("ig_account_id").eq("id", shopId).single();
      if (!shop?.ig_account_id) throw new NonRetriableError("instagram not connected");

      if (post.status === "approved") {
        const { data: claimed } = await admin
          .from("posts")
          .update({ status: "publishing" })
          .eq("id", postId)
          .eq("status", "approved")
          .select("id")
          .maybeSingle();
        if (!claimed) return null;
      }

      return {
        slides: slides.map((s) => ({ order: s.order, path: s.slide_path, alt: s.alt })),
        caption: buildCaption(post.chosen_caption, post.hashtags),
        mediaId: post.ig_media_id,
      };
    });
    if (!input) return { skipped: "not_approved" };

    const finish = (mediaId: string) =>
      step.run("finish", async () => {
        const permalink = await guard(shopId, async () => getPermalink(await getValidToken(shopId), mediaId));
        const { error } = await createAdminClient()
          .from("posts")
          .update({ status: "published", ig_media_id: mediaId, permalink, published_at: new Date().toISOString() })
          .eq("id", postId)
          .eq("status", "publishing");
        if (error) throw new Error(error.message);
      });

    // An earlier run already published this carousel and only failed afterwards, so
    // finish the record instead of posting a second copy.
    if (input.mediaId) {
      await finish(input.mediaId);
      return { postId, mediaId: input.mediaId, resumed: true };
    }

    // One container per slide. Tokens and signed URLs stay inside the step: Inngest stores
    // step results, so only container ids are returned.
    const children: string[] = [];
    for (const s of input.slides) {
      const id = await step.run(`slide-${s.order}`, () =>
        withStep(ctx, `ig_upload_slide_${s.order}`, null, () =>
          guard(shopId, async () => {
            const url = await jpegSignedUrl(shopId, postId, s.order, s.path);
            return createImageContainer(await getValidToken(shopId), { imageUrl: url, alt: s.alt });
          }),
        ),
      );
      children.push(id);
    }
    await waitFinished(step, ctx, "children", children);

    const carousel = await step.run("carousel", () =>
      withStep(ctx, "ig_create_carousel", null, () =>
        guard(shopId, async () =>
          createCarouselContainer(await getValidToken(shopId), { children, caption: input.caption }),
        ),
      ),
    );
    await waitFinished(step, ctx, "carousel", [carousel]);

    // Instagram has no idempotency key. If a previous attempt published but its response was
    // lost, the container reads PUBLISHED, so look the media up instead of posting twice.
    const mediaId = await step.run("publish", () =>
      withStep(ctx, "ig_publish", null, () =>
        guard(shopId, async () => {
          const token = await getValidToken(shopId);
          let id: string;
          if ((await containerStatus(token, carousel)) === "PUBLISHED") {
            const found = await findRecentMedia(token, input.caption);
            if (!found) throw new NonRetriableError("container already published but media not found");
            id = found;
          } else {
            id = await publishContainer(token, carousel);
          }
          // Record the media id the moment it exists. If a later step fails, Approve resumes
          // at finish instead of publishing the carousel a second time.
          const { error } = await createAdminClient().from("posts").update({ ig_media_id: id }).eq("id", postId);
          if (error) console.error("store ig_media_id failed", postId, error.message);
          return id;
        }),
      ),
    );

    await finish(mediaId);
    return { postId, mediaId };
  },
);

// Meta fetches images over plain HTTP and accepts JPEG only (FR-PB-01). The verified slide
// PNG is converted losslessly in terms of content (no model, no edits: FR-CG-09) and served
// through a short-lived signed URL, so the bucket stays private (NFR-13).
async function jpegSignedUrl(shopId: string, postId: string, order: number, slidePath: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("media").download(slidePath);
  if (error || !data) throw new Error(`download ${slidePath}: ${error?.message ?? "empty"}`);

  const jpeg = await sharp(Buffer.from(await data.arrayBuffer()))
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();

  const path = `${shopId}/publish/${postId}-${order}.jpg`;
  const up = await admin.storage.from("media").upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
  if (up.error) throw new Error(`upload ${path}: ${up.error.message}`);

  const signed = await admin.storage.from("media").createSignedUrl(path, SIGNED_URL_SECONDS);
  if (signed.error || !signed.data) throw new Error(`sign ${path}: ${signed.error?.message ?? "empty"}`);
  return signed.data.signedUrl;
}

type StepTools = {
  run: (id: string, fn: () => Promise<string[]>) => Promise<string[]>;
  sleep: (id: string, time: string) => Promise<unknown>;
};

// Polls until every container is FINISHED. Each poll is its own step with a durable sleep
// between, so a worker restart never loses progress. ERROR / EXPIRED will not recover.
async function waitFinished(step: StepTools, ctx: { shopId: string; postId: string }, label: string, ids: string[]) {
  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    const statuses = await step.run(`check-${label}-${i}`, () =>
      guard(ctx.shopId, async () => {
        const token = await getValidToken(ctx.shopId);
        return Promise.all(ids.map((id) => containerStatus(token, id)));
      }),
    );
    const bad = statuses.find((s) => s === "ERROR" || s === "EXPIRED");
    if (bad) throw new NonRetriableError(`instagram rejected the ${label} (${bad})`);
    if (statuses.every((s) => s === "FINISHED" || s === "PUBLISHED")) return;
    await step.sleep(`wait-${label}-${i}`, "10s");
  }
  throw new NonRetriableError(`instagram did not finish the ${label} in time`);
}

// Cron instagram.tokens (FR-PB-05): refresh long-lived tokens ahead of their 60-day expiry
// so no publish fails on an expired token. One step per shop isolates failures (NFR-15).
export const refreshInstagramTokens = inngest.createFunction(
  { id: "instagram-token-refresh", retries: 1, triggers: [{ cron: "0 3 * * *" }] },
  async ({ step }) => {
    const shops = await step.run("due", async () => {
      const cutoff = new Date(Date.now() + 30 * 86_400_000).toISOString();
      const { data } = await createAdminClient()
        .from("shop_secrets")
        .select("shop_id")
        .not("ig_token_encrypted", "is", null)
        .lt("ig_token_expires_at", cutoff);
      return (data ?? []).map((r) => r.shop_id);
    });

    const results: Record<string, string> = {};
    for (const shopId of shops) {
      results[shopId] = await step.run(`refresh-${shopId}`, () =>
        refreshShopToken(shopId).catch((e) => `error: ${e instanceof Error ? e.message : "unknown"}`),
      );
    }
    return results;
  },
);
