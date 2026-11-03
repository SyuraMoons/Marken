import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { SETUP_STEPS, SetupShell } from "@/components/setup-shell";
import { SetupSteps } from "@/components/setup-steps";
import { getBrandKit } from "@/lib/data/brand-kit";
import { getProducts } from "@/lib/data/products";
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
  const [products, rules, brandKit] = await Promise.all([
    getProducts(shop.id),
    supabase.from("style_rules").select("text").eq("shop_id", shop.id).order("position"),
    getBrandKit(shop.id),
  ]);

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
      />
    </SetupShell>
  );
}
