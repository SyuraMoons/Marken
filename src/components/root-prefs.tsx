"use client";

import { useEffect } from "react";

type Installable = Event & { prompt: () => Promise<void> };
declare global {
  interface Window {
    __markenInstall?: Installable | null;
  }
}

export const INSTALL_EVENT = "marken-install";

// App-wide, mounted once in the root layout: applies the saved motion choice on every page load
// and keeps the one-shot install prompt, which browsers fire early, for the Settings button.
export function RootPrefs() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem("marken-motion");
      if (saved) document.documentElement.dataset.motion = saved === "reduce" ? "reduce" : "full";
    } catch {}

    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__markenInstall = e as Installable;
      window.dispatchEvent(new Event(INSTALL_EVENT));
    };
    const onInstalled = () => {
      window.__markenInstall = null;
      window.dispatchEvent(new Event(INSTALL_EVENT));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}
