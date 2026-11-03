"use client";

import { useSyncExternalStore } from "react";

// Motion is off when the OS or the Settings switch (data-motion, "marken-motion" event) asks for it.
const subscribe = (callback: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  window.addEventListener("marken-motion", callback);
  return () => {
    query.removeEventListener("change", callback);
    window.removeEventListener("marken-motion", callback);
  };
};

export const prefersReducedMotion = () =>
  document.documentElement.dataset.motion === "reduce" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Server snapshot is `true` so the first paint is still until the client confirms.
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => true);
}
