import { Suspense, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { AppNav, NavLinks, type NavItem } from "./app-nav";
import { Logo } from "./logo";

const NAV: NavItem[] = [
  { href: "/today", label: t("nav.today") },
  { href: "/products", label: t("nav.products") },
  { href: "/results", label: t("nav.results") },
  { href: "/settings", label: t("nav.settings") },
];

function Nav({ variant }: { variant: "bar" | "side" }) {
  const props = { items: NAV, variant, label: t("nav.label") };
  return (
    <Suspense fallback={<NavLinks {...props} active="" />}>
      <AppNav {...props} />
    </Suspense>
  );
}

const initials = (name: string) =>
  name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// One shell for every signed-in screen: bottom nav < lg, 224px sidebar >= lg (DX-20..24).
export function AppShell({ shopName, children }: { shopName: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-surface">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-8 border-r border-border bg-white px-4 py-6 lg:flex">
        <Logo href="/today" />
        <Nav variant="side" />
        <div className="mt-auto rounded-control bg-surface p-3">
          <p className="text-sm font-semibold">{shopName}</p>
          <p className="text-xs text-muted">{t("nav.shopCaption")}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between px-6 lg:border-b lg:border-border lg:bg-white">
          <span className="lg:hidden">
            <Logo href="/today" />
          </span>
          <span className="hidden text-sm text-muted lg:block">{t("nav.workspace")}</span>
          <span className="flex items-center gap-2 text-sm font-medium">
            {shopName}
            <span aria-hidden="true" className="hidden size-8 items-center justify-center rounded-full bg-powder text-xs text-blue lg:flex">
              {initials(shopName)}
            </span>
          </span>
        </header>
        <main className="flex-1 px-6 pb-8 lg:px-8 lg:py-8">{children}</main>
        <div className="sticky bottom-0 lg:hidden">
          <Nav variant="bar" />
        </div>
      </div>
    </div>
  );
}
