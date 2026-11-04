import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { findActiveShop } from "@/lib/supabase/active-shop";
import { shopToday, type Post, type Shop } from "@/lib/api/owner";
import { asCaptions } from "@/lib/posts/captions";
import { canDeletePost } from "@/lib/posts/deletable";
import { allSlidesPassed, asSlides, type Slide } from "@/lib/posts/slides";

const TTL_S = 60 * 60;

export const getOwnerShop = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { shop } = await findActiveShop(supabase, user.id);
  return shop ? { shop, user } : null;
});

// Storage paths become short-lived signed URLs; the browser never sees a path (NFR-13).
async function sign(paths: string[], download = false) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  const admin = createAdminClient();
  const { data } = await admin.storage
    .from("media")
    .createSignedUrls(unique, TTL_S, download ? { download: true } : undefined);
  return new Map((data ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
}

export async function signPath(path: string | null) {
  return path ? ((await sign([path])).get(path) ?? null) : null;
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// `postId` opens one earlier post from History; without it Today shows its own latest post.
// A post id outside the active shop finds nothing (RLS plus the shop filter) and comes back as `missing`.
export async function getTodayData(postId?: string) {
  const owner = await getOwnerShop();
  if (!owner) return null;
  const { shop } = owner;
  const supabase = await createClient();

  if (postId) {
    const { data: picked } = isUuid(postId)
      ? await supabase.from("posts").select("*").eq("id", postId).eq("shop_id", shop.id).maybeSingle()
      : { data: null };
    if (!picked) return { shop, missing: true as const };
    return { ...(await loadPost(supabase, shop, picked)), missing: false as const };
  }

  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("shop_id", shop.id)
    .eq("post_date", shopToday(shop.time_zone))
    .not("status", "eq", "skipped")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // A skipped post still gets its own screen when it is the only one today.
  const latest =
    post ??
    (
      await supabase
        .from("posts")
        .select("*")
        .eq("shop_id", shop.id)
        .eq("post_date", shopToday(shop.time_zone))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data;
  if (!latest) {
    return { shop, post: null, slides: [] as Slide[], downloads: [] as string[], trend: null, photo: null, cutout: null, productName: null, steps: [], calls: [], missing: false as const };
  }
  return { ...(await loadPost(supabase, shop, latest)), missing: false as const };
}

type Db = Awaited<ReturnType<typeof createClient>>;

async function loadPost(supabase: Db, shop: Shop, latest: Post) {
  const [trend, product, steps, calls] = await Promise.all([
    latest.trend_id
      ? supabase.from("trends").select("title, url").eq("id", latest.trend_id).maybeSingle()
      : Promise.resolve({ data: null }),
    latest.product_id
      ? supabase.from("products").select("name, source_upload_id, cutout_path").eq("id", latest.product_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("post_steps").select("*").eq("post_id", latest.id).order("started_at"),
    supabase
      .from("model_calls")
      .select("step, latency_ms, cost_usd, cache_hit, fallback")
      .eq("post_id", latest.id)
      .order("created_at"),
  ]);

  let originalPath: string | null = null;
  if (product.data?.source_upload_id) {
    const { data: upload } = await supabase
      .from("media_uploads")
      .select("storage_path")
      .eq("id", product.data.source_upload_id)
      .maybeSingle();
    originalPath = upload?.storage_path ?? null;
  }

  const raw = asSlides(latest.slides);
  const paths = raw.map((s) => s.slide_path);
  const cutoutPath = product.data?.cutout_path ?? null;
  const [view, files, original] = await Promise.all([
    sign(paths),
    sign(paths, true),
    sign([originalPath, cutoutPath].filter((p): p is string => Boolean(p))),
  ]);
  const slides: Slide[] = raw.map((s) => ({ ...s, slide_path: view.get(s.slide_path) ?? "", scene_path: "" }));
  const downloads = raw.map((s) => files.get(s.slide_path) ?? "");

  return {
    shop,
    post: latest,
    slides,
    downloads,
    trend: trend.data,
    photo: product.data && originalPath ? { src: original.get(originalPath) ?? "", name: product.data.name } : null,
    // The confirmed cutout the studio shows while the scene is built around it.
    cutout: cutoutPath ? (original.get(cutoutPath) ?? null) : null,
    productName: product.data?.name ?? null,
    steps: steps.data ?? [],
    calls: calls.data ?? [],
  };
}

export type HistoryItem = {
  id: string;
  status: string;
  postDate: string;
  createdAt: string;
  productName: string | null;
  caption: string;
  hashtags: string[];
  slideCount: number;
  thumb: string | null;
  /** Signed attachment URLs, only when every slide passed the product check (FR-FD-01). */
  downloads: string[];
  canDelete: boolean;
};

// Every post the active shop ever generated, newest first, so nothing is lost when a newer run
// replaces it on Today. Only slide 1 is signed, as the thumbnail.
export async function getPostHistory(limit = 60): Promise<HistoryItem[] | null> {
  const owner = await getOwnerShop();
  if (!owner) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id, status, post_date, created_at, approved_at, slides, chosen_caption, caption_options, hashtags, products(name)")
    .eq("shop_id", owner.shop.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const first = rows.map((r) => asSlides(r.slides)[0]?.slide_path ?? "");
  const savable = rows.map((r) => {
    const slides = asSlides(r.slides);
    return allSlidesPassed(slides) ? slides.map((s) => s.slide_path) : [];
  });
  const [signed, files] = await Promise.all([sign(first), sign(savable.flat(), true)]);
  return rows.map((r, i) => {
    return {
      id: r.id,
      status: r.status,
      postDate: r.post_date,
      createdAt: r.created_at,
      productName: r.products?.name ?? null,
      caption: r.chosen_caption ?? asCaptions(r.caption_options)[0] ?? "",
      hashtags: r.hashtags ?? [],
      slideCount: asSlides(r.slides).length,
      thumb: signed.get(first[i]) ?? null,
      downloads: savable[i].map((p) => files.get(p) ?? ""),
      canDelete: canDeletePost(r, Boolean(owner.shop.ig_account_id)),
    };
  });
}
