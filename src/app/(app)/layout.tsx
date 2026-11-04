import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { getOwnerShop } from "@/lib/data/today";
import { createClient } from "@/lib/supabase/server";

// Auth guard lives in src/proxy.ts (FR-AU-04).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<AppShell shopName="" products={[]}>{children}</AppShell>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const owner = await getOwnerShop();
  const { data: products } = owner
    ? await (await createClient()).from("products").select("id, name").eq("shop_id", owner.shop.id).eq("hidden", false).order("created_at")
    : { data: [] };
  return (
    <AppShell shopName={owner?.shop.name ?? ""} products={products ?? []} account={{ email: owner?.user.email ?? null, provider: owner?.user.provider ?? null }}>
      {children}
    </AppShell>
  );
}
