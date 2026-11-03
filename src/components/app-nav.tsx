"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export type NavItem = { href: string; label: string; icon: string };

// Post screens live under Today (DX-23).
function section(pathname: string) {
  return pathname.startsWith("/posts") ? "/today" : "/" + pathname.split("/")[1];
}

type Props = { items: NavItem[]; variant: "bar" | "side"; label: string };

export function AppNav(props: Props) {
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  const active = pathname === "/today" && (view === "activity" || view === "details")
    ? "/today?view=activity"
    : section(pathname);
  return <NavLinks {...props} active={active} />;
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

// URL-independent fallback also keeps the selected mobile link in view.
export function NavLinks({ items, variant, label, active }: Props & { active: string }) {
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (variant !== "bar") return;
    const nav = bar.current;
    const link = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !link) return;
    const bounds = nav.getBoundingClientRect();
    const item = link.getBoundingClientRect();
    if (item.left < bounds.left) nav.scrollLeft -= bounds.left - item.left + 12;
    else if (item.right > bounds.right) nav.scrollLeft += item.right - bounds.right + 12;
  }, [active, variant]);
  if (variant === "side") {
    return (
      <nav data-tour="navigation" aria-label={label} className="flex flex-col gap-2">
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
    <nav data-tour="navigation" ref={bar} aria-label={label} className="nav-glass flex h-16 max-w-full items-center gap-1 overflow-x-auto px-3 py-2">
      {items.map(({ href, label }) => {
        const on = href === active;
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`relative isolate flex min-h-11 min-w-22 shrink-0 items-center justify-center rounded-control border px-2 text-[13px] leading-[14px] font-bold whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-navy ${on ? "nav-active-glass text-ink" : "border-transparent text-link hover:bg-powder/40"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
