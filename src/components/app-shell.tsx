import { AppHelp } from "./app-help";
import { Suspense, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { AppNav, Crumb, NavLinks, type NavItem } from "./app-nav";
import { Logo } from "./logo";
import { ProfileMenu, type Account } from "./profile-menu";
import { ShopSwitcher, type SwitcherShop } from "./shop-switcher";

const NAV: NavItem[] = [
  { href: "/today", label: t("nav.today"), icon: "today" },
  { href: "/posts", label: t("nav.history"), icon: "activity" },
  { href: "/products", label: t("nav.products"), icon: "products" },
  { href: "/results", label: t("nav.results"), icon: "results" },
  { href: "/settings", label: t("nav.settings"), icon: "settings" },
];
// Agent activity is shown inline on Today and in the studio, so it no longer has its own tab (FD-45).
function Nav({ variant }: { variant: "bar" | "side" }) {
  const props = { items: NAV, variant, label: t("nav.label") };
  return (
    <Suspense fallback={<NavLinks {...props} active="" />}>
      <AppNav {...props} />
    </Suspense>
  );
}

// One shell keeps mobile web tabs below the header and the desktop sidebar consistent.
export function AppShell({ shopName, shops, account, children }: { shopName: string; shops: SwitcherShop[]; account?: Account; children: ReactNode }) {
  return (
    <div className="bg-app flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col justify-between bg-navy px-6 pt-8 pb-6 lg:flex">
        <div className="flex flex-col gap-[30px]">
          <Logo href="/today" tone="white" />
          <Nav variant="side" />
        </div>
        <ShopSwitcher shops={shops} variant="side" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex h-15 items-center justify-between gap-2 px-5 lg:glass lg:h-auto lg:border-x-0 lg:border-t-0 lg:px-10 lg:py-[22px]">
          <span className="lg:hidden">
            <Logo href="/today" />
          </span>
          <span className="lg:hidden">
            <ShopSwitcher shops={shops} variant="pill" />
          </span>
          <span className="hidden lg:block">
            <Suspense fallback={<span className="text-[13px] text-muted">{t("nav.workspace")}</span>}>
              <Crumb root={t("nav.workspace")} />
            </Suspense>
          </span>
          <span className="flex items-center gap-3">
            <span className="hidden text-[13px] font-medium text-ink lg:block">{shopName}</span>
            <ProfileMenu shopName={shopName} account={account} />
          </span>
        </header>
        <div className="min-w-0 lg:hidden">
          <Nav variant="bar" />
        </div>
        <main className="flex-1 px-5 pt-6 pb-24 lg:px-10 lg:pt-10 lg:pb-24">{children}</main>
      </div>
      <AppHelp />
    </div>
  );
}
