"use client";

import Link from "next/link";
import { CookingOverlay } from "./cooking-overlay";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { t } from "@/lib/i18n";

export type SwitcherProduct = { id: string; name: string };

export function ProductSwitcher({ products, variant }: { products: SwitcherProduct[]; variant: "side" | "pill" }) {
  const params = useSearchParams();
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const selected = params.get("product") ?? params.get("edit");
  const active = products.find((p) => p.id === selected);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const side = variant === "side";
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", escape); };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <CookingOverlay active={switching} />
      <button type="button" aria-expanded={open} aria-label={t("nav.switchProduct")} onClick={() => setOpen(!open)} className={side ? "flex min-h-11 w-full items-center justify-between gap-2 rounded-control border border-white/20 bg-white/12 px-3 py-3 text-left text-white backdrop-blur-md" : "flex min-h-11 max-w-40 items-center gap-2 rounded-control bg-white p-2 text-xs font-semibold text-ink"}>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[13px] font-semibold">{active?.name ?? t("nav.products")}</span>
          {side && <span className="text-[11px]">{t("nav.switchProduct")}</span>}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && <div aria-label={t("nav.switchProduct")} className={`absolute z-30 flex max-h-72 w-60 flex-col gap-1 overflow-y-auto rounded-card bg-white p-2 text-ink shadow-lg ${side ? "bottom-full left-0 mb-2" : "top-full left-0 mt-2"}`}>
        {products.map((p) => <Link key={p.id} href={`/products?edit=${p.id}`} aria-current={active?.id === p.id ? "true" : undefined} onNavigate={(event) => { event.preventDefault(); setOpen(false); startSwitch(() => router.push(`/products?edit=${p.id}`)); }} className="flex min-h-11 items-center justify-between gap-2 rounded-control px-3 py-2 text-sm font-semibold hover:bg-app focus-visible:outline-2 focus-visible:outline-blue"><span className="truncate">{p.name}</span>{active?.id === p.id && <span aria-hidden="true">✓</span>}</Link>)}
        {!products.length && <p className="px-3 py-2 text-xs text-muted">{t("nav.noProducts")}</p>}
        <Link href="/products?add=1" onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-control px-3 py-2 text-sm font-semibold text-blue hover:bg-app">+ {t("products.add")}</Link>
      </div>}
    </div>
  );
}
