import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { getOwnerShop } from "@/lib/data/today";
import { listShops } from "@/lib/supabase/active-shop";
import { createClient } from "@/lib/supabase/server";

// Auth guard lives in src/proxy.ts (FR-AU-04).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<AppShell shopName="" shops={[]}>{children}</AppShell>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const owner = await getOwnerShop();
  // Every company the owner has; products and the rest are scoped to the active one (SRD v2.1 A-12).
  const { shops } = owner ? await listShops(await createClient(), owner.user.id) : { shops: [] };
  const switcher = shops.map((s) => ({
    id: s.id,
    name: s.name ?? "",
    active: s.id === owner?.shop.id,
    completed: Boolean(s.onboarding_completed_at),
  }));
  return (
    <AppShell shopName={owner?.shop.name ?? ""} shops={switcher} account={{ email: owner?.user.email ?? null, provider: owner?.user.provider ?? null }}>
      {children}
    </AppShell>
  );
}
