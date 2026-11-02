import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { getOwnerShop } from "@/lib/data/today";
import { createClient } from "@/lib/supabase/server";

// Auth guard lives in src/proxy.ts (FR-AU-04).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<AppShell shopName="" productName="">{children}</AppShell>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const owner = await getOwnerShop();
  // shortcut: shows the first product until a selected product exists (SRD v2.1 A-05).
  const product = owner
    ? (await (await createClient()).from("products").select("name").eq("shop_id", owner.shop.id).order("created_at").limit(1).maybeSingle()).data
    : null;
  return (
    <AppShell shopName={owner?.shop.name ?? ""} productName={product?.name ?? ""}>
      {children}
    </AppShell>
  );
}
