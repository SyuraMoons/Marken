import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { shopToday } from "@/lib/api/owner";
import { asSlides, type Slide } from "@/lib/posts/slides";

const TTL_S = 60 * 60;

export const getOwnerShop = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("shops").select("*").eq("owner_id", user.id).maybeSingle();
  return data ? { shop: data, user } : null;
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

export async function getTodayData() {
  const owner = await getOwnerShop();
  if (!owner) return null;
  const { shop } = owner;
  const supabase = await createClient();

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
    return { shop, post: null, slides: [] as Slide[], downloads: [] as string[], trend: null, photo: null, cutout: null, productName: null, steps: [], calls: [] };
  }

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
