"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// shortcut: re-reads the page every few seconds while a job runs (FD-12), swap for Supabase Realtime if it lags.
export function AutoRefresh({ ms = 3000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), ms);
    return () => clearInterval(id);
  }, [router, ms]);
  return null;
}
