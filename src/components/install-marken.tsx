"use client";

import { useSyncExternalStore } from "react";
import { t } from "@/lib/i18n";
import { Button } from "./button";
import { INSTALL_EVENT } from "./root-prefs";

const subscribe = (cb: () => void) => {
  window.addEventListener(INSTALL_EVENT, cb);
  return () => window.removeEventListener(INSTALL_EVENT, cb);
};

// Install Marken (NFR-08): shown only when the browser offers an install prompt (kept by RootPrefs).
export function InstallMarken() {
  const deferred = useSyncExternalStore(
    subscribe,
    () => window.__markenInstall ?? null,
    () => null,
  );

  if (!deferred) return null;

  return (
    <Button
      variant="secondary"
      onClick={async () => {
        // The prompt is one-shot: drop it whatever the owner chooses.
        window.__markenInstall = null;
        window.dispatchEvent(new Event(INSTALL_EVENT));
        await deferred.prompt().catch(() => {});
      }}
    >
      {t("settings.install")}
    </Button>
  );
}
