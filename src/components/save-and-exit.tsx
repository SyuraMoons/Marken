"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { t } from "@/lib/i18n";
import { Button } from "./button";

// Save and exit (FR-OB-11): PATCH step save, exit only when the save actually lands.
export function SaveAndExit({ shopId, step }: { shopId: string; step: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const save = async () => {
    setPending(true);
    setError(false);
    const res = await fetch(`/api/shops/${shopId}/onboarding`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    }).catch(() => null);
    setPending(false);
    if (res?.status === 401) return router.push("/login");
    if (!res?.ok) return setError(true);
    router.push("/");
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="text" className="w-auto! px-0" onClick={save} disabled={pending} aria-busy={pending}>
        {t("setup.saveExit")}
      </Button>
      {error && (
        <p role="alert" className="text-right text-sm text-danger">
          {t("setup.saveError")}
        </p>
      )}
    </div>
  );
}
