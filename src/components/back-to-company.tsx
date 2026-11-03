"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { Button } from "./button";
import { switchShop } from "./shop-switcher";

// While a new company is being set up the app is locked to its onboarding; this is the way back to
// a finished company (SRD v2.1 A-12).
export function BackToCompany({ others, className = "" }: { others: { id: string; name: string }[]; className?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  if (!others.length) return null;

  const go = async (id: string) => {
    setPending(true);
    setError(false);
    if ((await switchShop(id)) !== "ok") {
      setPending(false);
      setError(true);
    }
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {others.map((o) => (
        <Button key={o.id} variant="text" className={className} disabled={pending} onClick={() => go(o.id)}>
          {t("setup.backTo", { name: o.name || t("nav.newCompany") })}
        </Button>
      ))}
      {error && (
        <p role="alert" className="text-center text-sm text-danger">
          {t("nav.companyError")}
        </p>
      )}
    </div>
  );
}
