import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { AppNav, Crumb, NavLinks, type NavItem } from "./app-nav";
import { Logo } from "./logo";

const NAV: NavItem[] = [
  { href: "/today", label: t("nav.today"), icon: "today" },
  { href: "/products", label: t("nav.products"), icon: "products" },
  { href: "/results", label: t("nav.results"), icon: "results" },
  { href: "/settings", label: t("nav.settings"), icon: "settings" },
];
// Desktop sidebar also opens today's agent activity (2 Nov design, supersedes DX-11).
const SIDE: NavItem[] = [...NAV, { href: "/today?view=activity", label: t("nav.activity"), icon: "activity" }];

function Nav({ variant }: { variant: "bar" | "side" }) {
  const props = { items: variant === "side" ? SIDE : NAV, variant, label: t("nav.label") };
  return (
    <Suspense fallback={<NavLinks {...props} active="" />}>
      <AppNav {...props} />
    </Suspense>
  );
}

const initials = (name: string) =>
  name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// shortcut: the switcher opens Products until per-product scope exists (SRD v2.1 A-05, FD-29).
function ProductPill({ name }: { name: string }) {
  return (
    <Link href="/products" className="flex min-h-11 max-w-40 items-center gap-1 rounded-control bg-white p-2 text-xs leading-[1.4] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-blue">
      {/* eslint-disable-next-line @next/next/no-img-element -- static design icon */}
      <img src="/figma/switcher-product.svg" width={20} height={20} alt="" />
      <span className="truncate">{name || t("nav.products")}</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- static design icon */}
      <img src="/figma/switcher-chevron.svg" width={16} height={16} alt="" />
    </Link>
  );
}

// One shell for every signed-in screen: glass bottom nav < lg, navy 224px sidebar >= lg (FD-22, DX-20).
export function AppShell({ shopName, productName, children }: { shopName: string; productName: string; children: ReactNode }) {
  return (
    <div className="bg-app flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col justify-between bg-navy px-6 pt-8 pb-6 lg:flex">
        <div className="flex flex-col gap-[30px]">
          <Logo href="/today" tone="white" />
          <Nav variant="side" />
        </div>
        <Link
          href="/products"
          className="flex items-center gap-1.5 rounded-control border border-white/20 bg-white/12 px-2.5 py-3 text-white backdrop-blur-md focus-visible:outline-2 focus-visible:outline-white"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-[3px] leading-[1.4]">
            <span className="truncate text-[13px] font-semibold">{productName || t("nav.products")}</span>
            <span className="text-[11px]">{t("nav.switchProduct")}</span>
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- static design icon */}
          <img src="/figma/side-chevron.svg" width={18} height={18} alt="" />
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-15 items-center justify-between gap-2 px-5 lg:glass lg:h-auto lg:border-x-0 lg:border-t-0 lg:px-10 lg:py-[22px]">
          <span className="lg:hidden">
            <Logo href="/today" />
          </span>
          <span className="lg:hidden">
            <ProductPill name={productName} />
          </span>
          <span className="hidden lg:block">
            <Suspense fallback={<span className="text-[13px] text-muted">{t("nav.workspace")}</span>}>
              <Crumb root={t("nav.workspace")} />
            </Suspense>
          </span>
          <span className="hidden text-[13px] font-medium text-ink lg:block">
            {shopName}
            <span aria-hidden="true">{"  ·  "}{initials(shopName)}</span>
          </span>
        </header>
        <main className="flex-1 px-5 pt-6 pb-8 lg:px-10 lg:pt-10 lg:pb-12">{children}</main>
        <div className="sticky bottom-0 lg:hidden">
          <Nav variant="bar" />
        </div>
      </div>
    </div>
  );
}
