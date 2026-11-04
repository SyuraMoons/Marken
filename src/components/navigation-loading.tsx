"use client";

import { useLinkStatus } from "next/link";
import { CookingOverlay } from "./cooking-overlay";

export function NavigationLoading() {
  const { pending } = useLinkStatus();
  return <CookingOverlay active={pending} />;
}
