"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProductsIcon, ResultsIcon, SettingsIcon, TodayIcon } from "./icons";

export type NavItem = { href: string; label: string };

const ICONS: Record<string, () => React.JSX.Element> = {
  "/today": TodayIcon,
  "/products": ProductsIcon,
  "/results": ResultsIcon,
  "/settings": SettingsIcon,
};

// Post screens live under Today (DX-23).
function section(pathname: string) {
  return pathname.startsWith("/posts") ? "/today" : "/" + pathname.split("/")[1];
}

type Props = { items: NavItem[]; variant: "bar" | "side"; label: string };

export function AppNav(props: Props) {
  return <NavLinks {...props} active={section(usePathname())} />;
}

// Hook-free render, used as the Suspense fallback on dynamic routes (cacheComponents).
export function NavLinks({ items, variant, label, active }: Props & { active: string }) {
  if (variant === "side") {
    return (
      <nav aria-label={label} className="flex flex-col gap-1">
        {items.map(({ href, label }) => {
          const Icon = ICONS[href];
          const on = href === active;
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`flex h-11 items-center gap-3 rounded-control px-3 text-sm font-medium ${on ? "bg-powder text-blue" : "text-muted hover:bg-surface hover:text-ink"}`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label={label} className="grid h-18 grid-cols-4 border-t border-border bg-white pb-[env(safe-area-inset-bottom)]">
      {items.map(({ href, label }) => {
        const Icon = ICONS[href];
        const on = href === active;
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${on ? "text-blue" : "text-muted"}`}
          >
            <span className={`flex h-7 w-12 items-center justify-center rounded-full ${on ? "bg-powder" : ""}`}>
              <Icon />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
