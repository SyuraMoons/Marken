"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; icon: string };

// Post screens live under Today (DX-23).
function section(pathname: string) {
  return pathname.startsWith("/posts") ? "/today" : "/" + pathname.split("/")[1];
}

type Props = { items: NavItem[]; variant: "bar" | "side"; label: string };

export function AppNav(props: Props) {
  return <NavLinks {...props} active={section(usePathname())} />;
}

// "Workspace / today" breadcrumb on desktop.
export function Crumb({ root }: { root: string }) {
  return (
    <span className="text-[13px] text-muted">
      {root}
      <span aria-hidden="true">{"  /  "}</span>
      {section(usePathname()).slice(1)}
    </span>
  );
}

// Hook-free render, used as the Suspense fallback on dynamic routes (cacheComponents).
export function NavLinks({ items, variant, label, active }: Props & { active: string }) {
  if (variant === "side") {
    return (
      <nav aria-label={label} className="flex flex-col gap-2">
        {items.map(({ href, label, icon }) => {
          const on = href === active;
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-12 items-center gap-2 rounded-[10px] border p-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-white ${on ? "border-white/20 bg-white/12 backdrop-blur-md" : "border-transparent hover:bg-white/8"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static design icon */}
              <img src={`/figma/side-${icon}.svg`} width={20} height={20} alt="" />
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label={label} className="nav-glass grid h-18 grid-cols-4 gap-0.5 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {items.map(({ href, label, icon }) => {
        const on = href === active;
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border px-2 text-[11px] leading-[14px] font-medium text-white focus-visible:outline-2 focus-visible:outline-white ${on ? "border-white/18 bg-white/20" : "border-transparent"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static design icon */}
            <img src={`/figma/tab-${icon}.svg`} width={24} height={24} alt="" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
