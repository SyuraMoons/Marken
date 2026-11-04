import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { SETUP_STEPS, SetupShell } from "@/components/setup-shell";
import { SetupSteps, type PendingUpload, type SetupPreview } from "@/components/setup-steps";
import { getBrandKit } from "@/lib/data/brand-kit";
import { getProducts, type ProductView } from "@/lib/data/products";
import { signPath } from "@/lib/data/today";
import { asSlides } from "@/lib/posts/slides";
import { getCurrentUser } from "@/lib/supabase/auth";
import { listShops } from "@/lib/supabase/active-shop";
import { createClient } from "@/lib/supabase/server";

// 5 steps per SRD §6 (FD-03); DB checks onboarding_step between 1 and 5.
export function generateStaticParams() {
  return Array.from({ length: SETUP_STEPS }, (_, i) => ({ step: String(i + 1) }));
}

export default function OnboardingStepPage({ params }: PageProps<"/onboarding/[step]">) {
  // params must be read inside Suspense for instant navigation (cacheComponents).
  return (
    <Suspense fallback={<div className="bg-atmosphere min-h-dvh" />}>
      <Step params={params} />
    </Suspense>
  );
}

// The active company, or a first one created on a brand-new owner's first visit. Further companies
// are only added through POST /api/shops. The one-unfinished-shop index makes a racing create safe.
async function ensureShop(ownerId: string) {
  const supabase = await createClient();
  const found = await listShops(supabase, ownerId);
  if (found.shop || found.error) return found;
  await supabase.from("shops").insert({ owner_id: ownerId });
  return listShops(supabase, ownerId);
}

async function Step({ params }: Pick<PageProps<"/onboarding/[step]">, "params">) {
  const step = Number((await params).step);
  if (!Number.isInteger(step) || step < 1 || step > SETUP_STEPS) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { shop, shops } = await ensureShop(user.id);
  if (!shop) throw new Error("shop_unavailable");
  // Other finished companies the owner can go back to while this one is being set up.
  const others = shops.filter((s) => s.id !== shop.id && s.onboarding_completed_at).map((s) => ({ id: s.id, name: s.name ?? "" }));
  // No jumping ahead of the saved step (the PATCH route enforces the same).
  if (step > shop.onboarding_step) redirect(`/onboarding/${shop.onboarding_step}`);

  const supabase = await createClient();
  const [allProducts, rules, brandKit] = await Promise.all([
    getProducts(shop.id),
    supabase.from("style_rules").select("text").eq("shop_id", shop.id).order("position"),
    getBrandKit(shop.id),
  ]);
  // Hidden products are ignored by the server's step 3 check, so they stay out of onboarding too.
  const products = allProducts.filter((p) => !p.hidden);
  const pending = step === 2 ? await loadPending(supabase, shop.id, allProducts) : [];
  const preview = step >= 4 ? await loadPreview(supabase, shop.id, products) : null;

  return (
    <SetupShell step={step} shopId={shop.id} shopName={shop.name ?? ""} others={others}>
      <SetupSteps
        step={step}
        shop={{
          id: shop.id,
          name: shop.name ?? "",
          description: shop.description,
          category: shop.category,
          country: shop.country,
          content_language: shop.content_language === "id" ? "id" : "en",
          time_zone: shop.time_zone,
          tone: shop.tone,
          igConnected: Boolean(shop.ig_account_id),
          completed: Boolean(shop.onboarding_completed_at),
        }}
        products={products}
        rules={(rules.data ?? []).map((r) => r.text)}
        brandKit={brandKit}
        preview={preview}
        pending={pending}
      />
    </SetupShell>
  );
}

// Photos already uploaded but not turned into a product yet (still being prepared, or a run that died).
// What step 2 shows after a refresh or a trip back, so nothing is picked or processed twice.
async function loadPending(supabase: Db, shopId: string, products: ProductView[]): Promise<PendingUpload[]> {
  const used = new Set(products.flatMap((p) => (p.source_upload_id ? [p.source_upload_id] : [])));
  const { data } = await supabase
    .from("media_uploads")
    .select("id, storage_path, created_at")
    .eq("shop_id", shopId)
    .order("created_at");
  const rows = (data ?? []).filter((u) => !used.has(u.id));
  return Promise.all(rows.map(async (u) => ({ id: u.id, url: await signPath(u.storage_path), createdAt: u.created_at })));
}

type Db = Awaited<ReturnType<typeof createClient>>;

// The owner's own product for steps 4 and 5 (instead of an illustrative asset): the product of the
// latest post, else the first confirmed one, with its original photo and the post's first slide once built.
async function loadPreview(supabase: Db, shopId: string, products: ProductView[]): Promise<SetupPreview | null> {
  const { data: post } = await supabase
    .from("posts")
    .select("status, product_id, slides")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const product =
    products.find((p) => p.id === post?.product_id) ?? products.find((p) => p.cutout_confirmed && p.cutout_url) ?? products[0];
  if (!product) return null;

  const { data: upload } = product.source_upload_id
    ? await supabase.from("media_uploads").select("storage_path").eq("id", product.source_upload_id).maybeSingle()
    : { data: null };
  const slidePath = post && post.product_id === product.id ? (asSlides(post.slides)[0]?.slide_path ?? null) : null;
  const [photo, slide] = await Promise.all([signPath(upload?.storage_path ?? null), signPath(slidePath)]);

  return {
    name: product.name,
    cutout: product.cutout_url,
    photo,
    slide,
    postStatus: post?.status ?? null,
  };
}
