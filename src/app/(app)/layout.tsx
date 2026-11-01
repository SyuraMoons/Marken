import { AppShell } from "@/components/app-shell";
import { mockShop } from "@/lib/mock";

// Auth guard lives in src/proxy.ts (FR-AU-04).
export default function AppLayout({ children }: LayoutProps<"/">) {
  // shortcut: mock shop name, swap to the owner's shop query once reads land.
  return <AppShell shopName={mockShop.name ?? ""}>{children}</AppShell>;
}
