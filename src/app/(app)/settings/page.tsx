import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SettingsView } from "@/components/settings-view";
import { getBrandKit } from "@/lib/data/brand-kit";
import { getOwnerShop } from "@/lib/data/today";
import { createClient } from "@/lib/supabase/server";

// Settings rows + sub-views (F-15, DX-06, DX-27).
export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-64 max-w-xl animate-pulse rounded-card bg-white" />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const owner = await getOwnerShop();
  if (!owner) redirect("/login");
  const supabase = await createClient();
  const { data: rules } = await supabase
    .from("style_rules")
    .select("text")
    .eq("shop_id", owner.shop.id)
    .order("position");
  const { shop } = owner;
  const brandKit = await getBrandKit(shop.id);
  return (
    <SettingsView
      email={owner.user.email ?? ""}
      igConnected={Boolean(shop.ig_account_id)}
      rules={(rules ?? []).map((r) => r.text)}
      brandKit={brandKit}
      hasDescription={Boolean(shop.description?.trim())}
      shop={{
        id: shop.id,
        name: shop.name ?? "",
        category: shop.category ?? "Other",
        country: shop.country ?? "Other",
        time_zone: shop.time_zone ?? "UTC",
        content_language: shop.content_language === "id" ? "id" : "en",
        tone: shop.tone,
        notify_time: shop.notify_time.slice(0, 5),
      }}
    />
  );
}
