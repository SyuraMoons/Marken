import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { getOwnerShop } from "@/lib/data/today";

// Auth guard lives in src/proxy.ts (FR-AU-04).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<AppShell shopName="">{children}</AppShell>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const owner = await getOwnerShop();
  return <AppShell shopName={owner?.shop.name ?? ""}>{children}</AppShell>;
}
