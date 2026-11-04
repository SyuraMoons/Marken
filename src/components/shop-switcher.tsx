"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";

export type SwitcherShop = { id: string; name: string; active: boolean; completed: boolean };

type Result = "ok" | "limit" | "error";

// Switching reloads the page: every screen shows one company's data, and nothing from the old one may linger.
async function call(url: string): Promise<Result> {
  const res = await fetch(url, { method: "POST" }).catch(() => null);
  if (res?.ok) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose: drop all cached data of the old company
    window.location.href = "/today"; // the proxy sends an unfinished company to its saved setup step
    return "ok";
  }
  if (res?.status === 409 && (await res.json().catch(() => null))?.error === "shop_limit") return "limit";
  return "error";
}

export const switchShop = (id: string) => call(`/api/shops/${id}/activate`);

// Company switcher (SRD v2.1 A-12): each company has its own products, brand, posts and Instagram.
export function ShopSwitcher({ shops, variant }: { shops: SwitcherShop[]; variant: "side" | "pill" }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<Result | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const active = shops.find((s) => s.active);
  const name = active?.name || t("nav.newCompany");
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

  const run = async (go: () => Promise<Result>) => {
    setPending(true);
    setProblem(null);
    const result = await go();
    if (result !== "ok") {
      setPending(false);
      setProblem(result);
    }
  };

  const item = "flex w-full items-center justify-between gap-2 rounded-control px-3 py-2.5 text-left text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-blue disabled:opacity-60";
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
              <span className="text-[11px]">{t("nav.switchCompany")}</span>
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
          aria-label={t("nav.companyMenu")}
          className={`absolute z-30 flex max-h-72 w-60 flex-col gap-0.5 overflow-y-auto rounded-card bg-white p-1.5 text-ink shadow-lg ${side ? "bottom-full left-0 mb-2" : "top-full left-0 mt-2"}`}
        >
          {shops.map((s) => (
            <button
              key={s.id}
              type="button"
              role="menuitemradio"
              aria-checked={s.active}
              disabled={pending}
              onClick={() => (s.active ? setOpen(false) : run(() => switchShop(s.id)))}
              className={`${item} hover:bg-app`}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{s.name || t("nav.newCompany")}</span>
                {!s.completed && <span className="text-[11px] font-normal text-muted">{t("nav.setupUnfinished")}</span>}
              </span>
              {s.active && <span aria-hidden="true">✓</span>}
            </button>
          ))}
          <button type="button" role="menuitem" disabled={pending} onClick={() => run(() => call("/api/shops"))} className={`${item} text-blue hover:bg-app`}>
            + {t("nav.addCompany")}
          </button>
          {problem && (
            <p role="alert" className="px-3 py-2 text-xs text-danger">
              {problem === "limit" ? t("nav.companyLimit") : t("nav.companyError")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
