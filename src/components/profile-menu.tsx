"use client";

import { useEffect, useRef, useState } from "react";
import { signOutToWelcome } from "@/app/login/actions";
import { t } from "@/lib/i18n";

const initials = (name: string) =>
  name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "M";

export type Account = { email: string | null; provider: string | null };

const PROVIDER_KEY: Record<string, "nav.viaGoogle" | "nav.viaMeta" | "nav.viaEmail"> = {
  google: "nav.viaGoogle",
  facebook: "nav.viaMeta",
  email: "nav.viaEmail",
};

// Profile button in the app header; opens a menu with Sign out.
export function ProfileMenu({ shopName, account }: { shopName: string; account?: Account }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("nav.profileMenu")}
        onClick={() => setOpen((o) => !o)}
        className="flex size-11 items-center justify-center rounded-full bg-blue text-[13px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
      >
        {initials(shopName)}
      </button>
      {open && (
        <div role="menu" aria-label={t("nav.profileMenu")} className="absolute top-full right-0 z-30 mt-2 flex w-56 flex-col gap-0.5 rounded-card bg-white p-1.5 text-ink shadow-lg">
          <div className="flex flex-col gap-0.5 px-3 py-2 text-xs text-muted">
            {shopName && <p className="truncate font-semibold text-ink">{shopName}</p>}
            {account?.email && <p className="truncate">{account.email}</p>}
            {account?.provider && PROVIDER_KEY[account.provider] && <p>{t(PROVIDER_KEY[account.provider])}</p>}
          </div>
          <form action={signOutToWelcome}>
            <button type="submit" role="menuitem" className="block min-h-11 w-full rounded-control px-3 py-2.5 text-left text-[13px] font-semibold hover:bg-app focus-visible:outline-2 focus-visible:outline-blue">
              {t("settings.signOut")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
