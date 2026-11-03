"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";

export type SwitcherProduct = { id: string; name: string };

// Product switcher (SRD v2.1 A-05). shortcut: until per-product scope exists, picking a product opens it on Products.
export function ProductSwitcher({ products, variant }: { products: SwitcherProduct[]; variant: "side" | "pill" }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const name = products[0]?.name || t("nav.products");
  const side = variant === "side";

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const item = "block truncate rounded-control px-3 py-2.5 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-blue";
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={
          side
            ? "flex w-full items-center gap-1.5 rounded-control border border-white/20 bg-white/12 px-2.5 py-3 text-left text-white backdrop-blur-md focus-visible:outline-2 focus-visible:outline-white"
            : "flex min-h-11 max-w-40 items-center gap-1 rounded-control bg-white p-2 text-xs leading-[1.4] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-blue"
        }
      >
        {side ? (
          <>
            <span className="flex min-w-0 flex-1 flex-col gap-[3px] leading-[1.4]">
              <span className="truncate text-[13px] font-semibold">{name}</span>
              <span className="text-[11px]">{t("nav.switchProduct")}</span>
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element -- static design icon */}
            <img src="/figma/side-chevron.svg" width={18} height={18} alt="" />
          </>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- static design icon */}
            <img src="/figma/switcher-product.svg" width={20} height={20} alt="" />
            <span className="truncate">{name}</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- static design icon */}
            <img src="/figma/switcher-chevron.svg" width={16} height={16} alt="" />
          </>
        )}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t("nav.productMenu")}
          className={`absolute z-30 flex max-h-72 w-60 flex-col gap-0.5 overflow-y-auto rounded-card bg-white p-1.5 text-ink shadow-lg ${side ? "bottom-full left-0 mb-2" : "top-full right-0 mt-2"}`}
        >
          {products.map((p) => (
            <Link key={p.id} role="menuitem" href={`/products?edit=${p.id}`} onClick={() => setOpen(false)} className={`${item} hover:bg-app`}>
              {p.name}
            </Link>
          ))}
          <Link role="menuitem" href="/products?add=1" onClick={() => setOpen(false)} className={`${item} text-blue hover:bg-app`}>
            + {t("products.add")}
          </Link>
        </div>
      )}
    </div>
  );
}
